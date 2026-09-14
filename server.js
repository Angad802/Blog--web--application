import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import "dotenv/config";
import multer from "multer";
import path from "path";

const app = express();
const port = process.env.PORT;

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
    limits: {
        fileSize: 100 * 1024 * 1024
    }
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use("/upload", express.static("upload"));

const db = new pg.Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT),
});

db.on("error", (err) => {
    console.error("Unexpected error on idle PostgreSQL client", err);
});


function AuthenticateToken(req, res, next) {
    const AuthHeader = req.headers.authorization;

    const token = AuthHeader && AuthHeader.split(" ")[1]

    if (!token) {
        return res.status(401).json({
            message: "Access token required"
        });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({
                message: "Invalid or expired token"
            });
        }
        req.user = user;
        next();
    })
}




//CHALLENGE 1: GET All posts
app.get("/posts/", AuthenticateToken, async (req, res) => {
    try {
        const authorId = req.user.id.toString();
        const result = await db.query(`SELECT posts.*, COALESCE(users.name, 'Author') AS author_name
             FROM posts
             LEFT JOIN users ON users.id::text = posts.author
             WHERE posts.author = $1`,
            [authorId]);

        res.json(result.rows);
    } catch (err) {
        console.error("GET /posts DB ERROR:", err);
        res.status(500).json({ message: "database error" });
    }
});

//CHALLENGE 2: GET a specific post by id
app.get("/posts/:id", AuthenticateToken, async (req, res) => {
    try {
        const authorId = req.user.id.toString();
        const result = await db.query(`SELECT posts.*, COALESCE(users.name, 'Author') AS author_name
             FROM posts
             LEFT JOIN users ON users.id::text = posts.author
             WHERE posts.id = $1
             AND posts.author = $2`,
            [req.params.id, authorId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "post not found" });
        }
        res.json(result.rows[0]);
    }
    catch (err) {
        console.error("GET /posts/:id DB ERROR:", err);
        res.status(500).json({ message: "database error" });
    }

});

//CHALLENGE 3: POST a new post
app.post("/posts", AuthenticateToken, upload.fields([
    { name: "image", maxCount: 10 },
    { name: "video", maxCount: 10 }
]), async (req, res) => {
    try {
        const { title, content } = req.body;

        if (!title || !content) {
            return res.status(400).json({ message: "Title and content are required." });
        }

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

        const authorId = (req.user?.id || req.body?.author || "").toString();
        if (!authorId) {
            return res.status(400).json({ message: "Author identification is required." });
        }

        const result = await db.query(
            "INSERT INTO posts (title, content, author, image_url, video_url) VALUES ($1, $2, $3, $4, $5) RETURNING *",
            [title, content, authorId, imageUrl, videoUrl]
        );
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error("POST /posts DB ERROR:", err);
        res.status(500).json({ message: err.message || "Database error" });
    }

});

//CHALLENGE 4: PATCH a post when you just want to update one parameter
app.patch("/posts/:id", AuthenticateToken, async (req, res) => {
    try {
        const { title, content } = req.body;

        const result = await db.query("UPDATE posts SET (title, content) = ($1, $2) WHERE id = $3  AND author = $4 RETURNING *",
            [title, content, req.params.id, req.user.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "post not found" });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Database error" });

    }
});

//CHALLENGE 5: DELETE a specific post by providing the post id.

app.delete("/posts/:id", AuthenticateToken, async (req, res) => {
    try {
        const result = await db.query("DELETE FROM posts WHERE id = $1 AND author = $2 RETURNING *", [req.params.id, req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "post not found" });

        }
        res.json({
            message: "post deleted",
            posts: result.rows[0]
        });
    } catch (err) {
        console.log("DELETE ERROR:", err);
        res.status(500).json({
            message: "Database error"
        });
    }
});


app.post("/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: "All fields are required." });
        }

        const hashPassword = await bcrypt.hash(password, 10);

        const response = await db.query("INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email",
            [name, email, hashPassword]
        );
        res.status(201).json(response.rows[0]);
    } catch (err) {
        console.error("REGISTER DB ERROR:", err);
        if (err.code === "23505") {
            return res.status(400).json({ message: "Email is already registered. Please login instead." });
        }
        res.status(500).json({ message: "Database error" });
    }

});

app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const result = await db.query(
            "SELECT * FROM users WHERE email = $1",
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }
        const user = result.rows[0];

        const isPasswordCorrect = await bcrypt.compare(
            password,
            user.password
        );

        // Password galat hai
        if (!isPasswordCorrect) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const token = jwt.sign(
            {
                id: user.id,
                email: user.email
            },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        // Login successful
        res.status(200).json({
            message: "Login successful",
            token: token
        });

    } catch (err) {
        console.log(err);

        res.status(500).json({
            message: "Database error"
        });
    }
});





app.listen(port, () => {
    console.log(`server running on port ${port}`);
});