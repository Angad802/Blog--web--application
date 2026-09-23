import express from "express";
import bodyParser from "body-parser";
import session from "express-session";
import multer from "multer";
import path from "path";
import fs from "fs";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import "dotenv/config";

import db, { initDatabase } from "./db.js";
import passport from "./passport-config.js";

const app = express();
const port = process.env.PORT || process.env.Frontend_PORT || 3000;

// Ensure upload directory exists
const uploadDir = "upload";
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage for images & videos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "upload/");
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname || "") || (file.mimetype.includes("video") ? ".mp4" : ".jpg");
        cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 }
});

// Middleware setup
app.use(express.static("public"));
app.use("/upload", express.static("upload"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(session({
    secret: process.env.SESSION_SECRET || "blog-secret-key-98765",
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    }
}));

app.use(passport.initialize());
app.use(passport.session());

// Helper function to parse media URLs
function parseMediaUrls(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val.filter(Boolean);
    if (typeof val === "string") {
        const trimmed = val.trim();
        if (!trimmed) return [];
        if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) return parsed.filter(Boolean);
            } catch (e) { }
        }
        if (trimmed.includes(",")) {
            return trimmed.split(",").map(s => s.trim()).filter(Boolean);
        }
        return [trimmed];
    }
    return [];
}

// Extract authenticated user from session or JWT
function getAuthUser(req) {
    try {
        if (req.user && req.user.id) {
            return req.user;
        }
        if (req.session.userId) {
            return {
                id: req.session.userId,
                name: req.session.userName,
                email: req.session.userEmail
            };
        }
        if (req.session.token) {
            const decoded = jwt.verify(req.session.token, process.env.JWT_SECRET || "mysecret123");
            return decoded;
        }
    } catch (err) {
        return null;
    }
    return null;
}

// Global template variables
app.use((req, res, next) => {
    try {
        const authUser = getAuthUser(req);
        res.locals.isLoggedIn = !!authUser;
        res.locals.user = authUser;
        res.locals.apiUrl = "";
        res.locals.parseMediaUrls = parseMediaUrls;
        res.locals.error = req.query.error || null;
        res.locals.success = req.query.success || null;
    } catch (err) {
        res.locals.isLoggedIn = false;
        res.locals.user = null;
        res.locals.error = null;
        res.locals.success = null;
    }
    next();
});

// ==========================================
// GOOGLE & GITHUB OAUTH ROUTES
// ==========================================

// Google OAuth initiate
app.get("/auth/google", (req, res, next) => {
    try {
        if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
            return res.redirect("/login?error=" + encodeURIComponent("Google OAuth keys not configured yet in .env"));
        }
        passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
    } catch (err) {
        console.error("Google Auth error:", err);
        res.redirect("/login?error=" + encodeURIComponent("Failed to initialize Google login"));
    }
});

// Google OAuth callback
app.get("/auth/google/callback", (req, res, next) => {
    try {
        passport.authenticate("google", { failureRedirect: "/login?error=Google%20Login%20Failed" }, (err, user) => {
            if (err || !user) {
                console.error("Google Callback error:", err);
                return res.redirect("/login?error=" + encodeURIComponent(err?.message || "Google Authentication failed"));
            }
            req.logIn(user, (loginErr) => {
                if (loginErr) {
                    console.error("Session login error:", loginErr);
                    return res.redirect("/login?error=Session%20creation%20failed");
                }
                const token = jwt.sign(
                    { id: user.id, email: user.email, name: user.name },
                    process.env.JWT_SECRET || "mysecret123",
                    { expiresIn: "7d" }
                );
                req.session.token = token;
                req.session.userId = user.id;
                req.session.userName = user.name;
                req.session.userEmail = user.email;
                res.redirect("/");
            });
        })(req, res, next);
    } catch (err) {
        console.error("Google Callback Exception:", err);
        res.redirect("/login?error=Google%20Login%20Error");
    }
});

// GitHub OAuth initiate
app.get("/auth/github", (req, res, next) => {
    try {
        if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
            return res.redirect("/login?error=" + encodeURIComponent("GitHub OAuth keys not configured yet in .env"));
        }
        passport.authenticate("github", { scope: ["user:email"] })(req, res, next);
    } catch (err) {
        console.error("GitHub Auth error:", err);
        res.redirect("/login?error=" + encodeURIComponent("Failed to initialize GitHub login"));
    }
});

// GitHub OAuth callback
app.get("/auth/github/callback", (req, res, next) => {
    try {
        passport.authenticate("github", { failureRedirect: "/login?error=GitHub%20Login%20Failed" }, (err, user) => {
            if (err || !user) {
                console.error("GitHub Callback error:", err);
                return res.redirect("/login?error=" + encodeURIComponent(err?.message || "GitHub Authentication failed"));
            }
            req.logIn(user, (loginErr) => {
                if (loginErr) {
                    console.error("Session login error:", loginErr);
                    return res.redirect("/login?error=Session%20creation%20failed");
                }
                const token = jwt.sign(
                    { id: user.id, email: user.email, name: user.name },
                    process.env.JWT_SECRET || "mysecret123",
                    { expiresIn: "7d" }
                );
                req.session.token = token;
                req.session.userId = user.id;
                req.session.userName = user.name;
                req.session.userEmail = user.email;
                res.redirect("/");
            });
        })(req, res, next);
    } catch (err) {
        console.error("GitHub Callback Exception:", err);
        res.redirect("/login?error=GitHub%20Login%20Error");
    }
});

// ==========================================
// REGISTRATION & LOGIN ROUTES
// ==========================================

app.get("/register", (req, res) => {
    try {
        res.render("register.ejs");
    } catch (err) {
        console.error("Render Register Error:", err);
        res.status(500).send("Error rendering page");
    }
});

app.post("/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).render("register.ejs", { error: "All fields are required." });
        }

        const existingUser = await db.query("SELECT id FROM users WHERE email = $1", [email]);
        if (existingUser.rows.length > 0) {
            return res.status(400).render("register.ejs", { error: "Email is already registered. Please sign in instead." });
        }

        const hashPassword = await bcrypt.hash(password, 10);
        await db.query(
            "INSERT INTO users (name, email, password) VALUES ($1, $2, $3)",
            [name, email, hashPassword]
        );

        res.redirect("/login?success=" + encodeURIComponent("Account created successfully! Please sign in."));
    } catch (err) {
        console.error("Register Error:", err);
        res.status(500).render("register.ejs", { error: "Registration failed due to a database issue. Please try again." });
    }
});

app.get("/login", (req, res) => {
    try {
        res.render("login.ejs");
    } catch (err) {
        console.error("Render Login Error:", err);
        res.status(500).send("Error rendering page");
    }
});

app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).render("login.ejs", { error: "Email and password are required." });
        }

        const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);

        if (result.rows.length === 0) {
            return res.status(401).render("login.ejs", { error: "Invalid email or password" });
        }

        const user = result.rows[0];

        if (!user.password) {
            return res.status(401).render("login.ejs", {
                error: "This account was created using Google or GitHub. Please sign in using the buttons above."
            });
        }

        const isPasswordCorrect = await bcrypt.compare(password, user.password);
        if (!isPasswordCorrect) {
            return res.status(401).render("login.ejs", { error: "Invalid email or password" });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, name: user.name },
            process.env.JWT_SECRET || "mysecret123",
            { expiresIn: "7d" }
        );

        req.session.token = token;
        req.session.userId = user.id;
        req.session.userName = user.name;
        req.session.userEmail = user.email;

        res.redirect("/");
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).render("login.ejs", { error: "Login failed due to a database error. Please try again." });
    }
});

app.get("/logout", (req, res) => {
    try {
        req.logout(() => {});
        req.session.destroy((err) => {
            if (err) {
                console.error("Session destroy error:", err);
            }
            res.redirect("/");
        });
    } catch (err) {
        console.error("Logout error:", err);
        res.redirect("/");
    }
});

// ==========================================
// BLOG POST VIEW & EDIT ROUTES
// ==========================================

app.get("/", async (req, res) => {
    try {
        const authUser = getAuthUser(req);

        if (!authUser) {
            return res.render("index.ejs", { posts: [] });
        }

        const authorId = authUser.id.toString();
        const result = await db.query(
            `SELECT posts.*, COALESCE(users.name, 'Author') AS author_name
             FROM posts
             LEFT JOIN users ON users.id::text = posts.author
             WHERE posts.author = $1
             ORDER BY posts.date DESC`,
            [authorId]
        );

        res.render("index.ejs", { posts: result.rows });
    } catch (err) {
        console.error("Fetch Posts Error:", err);
        res.render("index.ejs", { posts: [] });
    }
});

app.get("/new", (req, res) => {
    try {
        const authUser = getAuthUser(req);
        if (!authUser) {
            return res.redirect("/login");
        }
        res.render("modify.ejs", { heading: "New post", submit: "Create post" });
    } catch (err) {
        console.error("New Post Page Error:", err);
        res.redirect("/");
    }
});

app.get("/edit/:id", async (req, res) => {
    try {
        const authUser = getAuthUser(req);
        if (!authUser) {
            return res.redirect("/login");
        }

        const authorId = authUser.id.toString();
        const result = await db.query(
            `SELECT posts.*, COALESCE(users.name, 'Author') AS author_name
             FROM posts
             LEFT JOIN users ON users.id::text = posts.author
             WHERE posts.id = $1 AND posts.author = $2`,
            [req.params.id, authorId]
        );

        if (result.rows.length === 0) {
            return res.redirect("/");
        }

        res.render("modify.ejs", {
            heading: "Edit post",
            submit: "Update post",
            post: result.rows[0],
        });
    } catch (err) {
        console.error("Edit Post Page Error:", err);
        res.redirect("/");
    }
});

// Create new post
app.post("/api/posts", upload.fields([
    { name: "image", maxCount: 10 },
    { name: "video", maxCount: 10 }
]), async (req, res) => {
    try {
        const authUser = getAuthUser(req);
        if (!authUser) {
            return res.redirect("/login");
        }

        const { title, content } = req.body;
        const authorId = authUser.id.toString();

        const imageFiles = req.files?.image || [];
        const videoFiles = req.files?.video || [];

        const imageUrls = imageFiles.filter(img => img.size > 0).map(img => `/upload/${img.filename}`);
        const videoUrls = videoFiles.filter(vid => vid.size > 0).map(vid => `/upload/${vid.filename}`);

        const imageUrl = imageUrls.length === 0
            ? null
            : (imageUrls.length === 1 ? imageUrls[0] : JSON.stringify(imageUrls));

        const videoUrl = videoUrls.length === 0
            ? null
            : (videoUrls.length === 1 ? videoUrls[0] : JSON.stringify(videoUrls));

        await db.query(
            "INSERT INTO posts (title, content, author, image_url, video_url) VALUES ($1, $2, $3, $4, $5)",
            [title || "Untitled", content || "", authorId, imageUrl, videoUrl]
        );

        res.redirect("/");
    } catch (err) {
        console.error("Create Post Error:", err);
        res.redirect("/");
    }
});

// Partially update a post
app.post("/api/posts/:id", async (req, res) => {
    try {
        const authUser = getAuthUser(req);
        if (!authUser) {
            return res.redirect("/login");
        }

        const { title, content } = req.body;
        const authorId = authUser.id.toString();

        await db.query(
            "UPDATE posts SET title = $1, content = $2 WHERE id = $3 AND author = $4",
            [title, content, req.params.id, authorId]
        );

        res.redirect("/");
    } catch (err) {
        console.error("Update Post Error:", err);
        res.redirect("/");
    }
});

// Delete a post (POST method)
app.post("/api/posts/delete/:id", async (req, res) => {
    try {
        const authUser = getAuthUser(req);
        if (!authUser) {
            return res.redirect("/login");
        }

        const authorId = authUser.id.toString();
        await db.query(
            "DELETE FROM posts WHERE id = $1 AND author = $2",
            [req.params.id, authorId]
        );

        res.redirect("/");
    } catch (err) {
        console.error("Delete Post Error:", err);
        res.redirect("/");
    }
});

// Delete a post (GET fallback)
app.get("/api/posts/delete/:id", async (req, res) => {
    try {
        const authUser = getAuthUser(req);
        if (!authUser) {
            return res.redirect("/login");
        }

        const authorId = authUser.id.toString();
        await db.query(
            "DELETE FROM posts WHERE id = $1 AND author = $2",
            [req.params.id, authorId]
        );

        res.redirect("/");
    } catch (err) {
        console.error("Delete Post Error:", err);
        res.redirect("/");
    }
});

// ==========================================
// REST API COMPATIBILITY ENDPOINTS
// ==========================================

function AuthenticateToken(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(" ")[1];

        if (!token) {
            return res.status(401).json({ message: "Access token required" });
        }

        jwt.verify(token, process.env.JWT_SECRET || "mysecret123", (err, user) => {
            if (err) {
                return res.status(403).json({ message: "Invalid or expired token" });
            }
            req.user = user;
            next();
        });
    } catch (err) {
        res.status(403).json({ message: "Authentication failed" });
    }
}

app.get("/posts", AuthenticateToken, async (req, res) => {
    try {
        const authorId = req.user.id.toString();
        const result = await db.query(
            `SELECT posts.*, COALESCE(users.name, 'Author') AS author_name
             FROM posts
             LEFT JOIN users ON users.id::text = posts.author
             WHERE posts.author = $1
             ORDER BY posts.date DESC`,
            [authorId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error("API GET /posts error:", err);
        res.status(500).json({ message: "database error" });
    }
});

app.get("/posts/:id", AuthenticateToken, async (req, res) => {
    try {
        const authorId = req.user.id.toString();
        const result = await db.query(
            `SELECT posts.*, COALESCE(users.name, 'Author') AS author_name
             FROM posts
             LEFT JOIN users ON users.id::text = posts.author
             WHERE posts.id = $1 AND posts.author = $2`,
            [req.params.id, authorId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "post not found" });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error("API GET /posts/:id error:", err);
        res.status(500).json({ message: "database error" });
    }
});

// Start the server and ensure database tables exist
app.listen(port, async () => {
    try {
        await initDatabase();
        console.log(`Server is running smoothly on port ${port}`);
    } catch (err) {
        console.error("Database initialization failed on startup:", err.message);
    }
});