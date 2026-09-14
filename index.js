import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import session from "express-session";
import multer from "multer";
import fs from "fs";
import FormData from "form-data";
import "dotenv/config";

const app = express();
const port = process.env.Frontend_PORT;
const API_URL = process.env.API_URL || "http://localhost:3000";
const upload = multer({
    dest: "temp/"
});

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 60 * 60 * 1000
    }
}));

function parseMediaUrls(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val.filter(Boolean);
    if (typeof val === 'string') {
        const trimmed = val.trim();
        if (!trimmed) return [];
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) return parsed.filter(Boolean);
            } catch (e) { }
        }
        if (trimmed.includes(',')) {
            return trimmed.split(',').map(s => s.trim()).filter(Boolean);
        }
        return [trimmed];
    }
    return [];
}

app.use((req, res, next) => {
    res.locals.isLoggedIn = !!req.session.token;
    res.locals.apiUrl = API_URL;
    res.locals.parseMediaUrls = parseMediaUrls;
    next();
});



app.get("/register", (req, res) => {
    res.render("register.ejs");
});

app.post("/register", async (req, res) => {
    try {
        const response = await axios.post(`${API_URL}/register`, req.body);
        res.redirect("/login");


    } catch (err) {
        console.log(err);
        res.status(400).send(err.response?.data?.message || "Registration failed. Email might already be in use.");
    }
});

app.get("/login", (req, res) => {
    res.render("login.ejs");
});

app.post("/login", async (req, res) => {
    try {
        const response = await axios.post(`${API_URL}/login`, req.body);

        req.session.token = response.data.token;
        console.log("TOKEN:", req.session.token);
        res.redirect("/");
    } catch (error) {
        console.log("LOGIN ERROR:", error.response?.data || error.message);
        res.status(401).send("Invalid email or password");
    }
})


app.get("/", async (req, res) => {
    try {

        const token = req.session.token;

        if (!token) {
            return res.render("index.ejs", {
                posts: []
            });
        }

        const response = await axios.get(`${API_URL}/posts`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        console.log(response);
        res.render("index.ejs", { posts: response.data });
    } catch (error) {
        res.status(500).json({ message: "error fetching post" });
    }

});

app.get("/new", (req, res) => {
    if (!req.session.token) {
        return res.redirect("/login");
    }
    res.render("modify.ejs", ({ heading: "New post", submit: "Create post" }));
});

app.get("/edit/:id", async (req, res) => {
    try {
        const token = req.session.token;

        console.log("EDIT SESSION:", req.session);
        console.log("EDIT TOKEN:", req.session.token);

        if (!token) {
            return res.redirect("/login");
        }

        const response = await axios.get(`${API_URL}/posts/${req.params.id}`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );
        console.log("EDIT POST:", response.data);


        res.render("modify.ejs", ({
            heading: "New post",
            submit: "Update post",
            post: response.data,
        }));
    } catch (error) {
        res.status(500).json({ message: "error fetching post" });
    }
});
// create new post

app.post("/api/posts", upload.fields([
    { name: "image", maxCount: 10 },
    { name: "video", maxCount: 10 }
]), async (req, res) => {
    const cleanupTempFiles = () => {
        const images = req.files?.image || [];
        const videos = req.files?.video || [];
        images.forEach(img => {
            if (img?.path) {
                fs.unlink(img.path, (err) => {
                    if (err) console.error("Error deleting temp image:", err);
                });
            }
        });
        videos.forEach(vid => {
            if (vid?.path) {
                fs.unlink(vid.path, (err) => {
                    if (err) console.error("Error deleting temp video:", err);
                });
            }
        });
    };

    try {
        const token = req.session.token;
        if (!token) {
            cleanupTempFiles();
            return res.redirect("/login");
        }

        const formData = new FormData();

        formData.append("title", req.body.title || "");
        formData.append("content", req.body.content || "");

        if (req.files?.image && req.files.image.length > 0) {
            for (const imgFile of req.files.image) {
                if (imgFile.size > 0) {
                    formData.append("image", fs.createReadStream(imgFile.path), {
                        filename: imgFile.originalname || "image.jpg",
                        contentType: imgFile.mimetype || "image/jpeg"
                    });
                }
            }
        }

        if (req.files?.video && req.files.video.length > 0) {
            for (const vidFile of req.files.video) {
                if (vidFile.size > 0) {
                    formData.append("video", fs.createReadStream(vidFile.path), {
                        filename: vidFile.originalname || "video.mp4",
                        contentType: vidFile.mimetype || "video/mp4"
                    });
                }
            }
        }

        const response = await axios.post(`${API_URL}/posts`,
            formData,
            {
                headers: {
                    ...formData.getHeaders(),
                    Authorization: `Bearer ${token}`
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            }
        );

        console.log(response.data);
        res.redirect("/");
    } catch (error) {
        console.log("CREATE ERROR:", error.response?.data || error.message);
        res.status(500).json({ message: error.response?.data?.message || "Error creating post" });
    } finally {
        cleanupTempFiles();
    }
});

// Partially update a post
app.post("/api/posts/:id", async (req, res) => {
    try {
        const token = req.session.token;
        if (!token) {
            return res.redirect("/login");
        }
        const response = await axios.patch(`${API_URL}/posts/${req.params.id}`, req.body, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        console.log(response.data);
        res.redirect("/");
    } catch (error) {
        res.status(500).json({ message: error.response?.data?.message || "Error updating post" });
    }
});

// Delete a post (POST method)
app.post("/api/posts/delete/:id", async (req, res) => {
    try {
        const token = req.session.token;
        await axios.delete(`${API_URL}/posts/${req.params.id}`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        res.redirect("/");
    } catch (error) {
        console.log("DELETE ERROR:", error.response?.data || error.message);
        res.status(500).json({ message: "Error deleting post" });
    }
});

// Delete a post (GET fallback for backwards compatibility)
app.get("/api/posts/delete/:id", async (req, res) => {
    try {
        const token = req.session.token;
        await axios.delete(`${API_URL}/posts/${req.params.id}`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        res.redirect("/");
    } catch (error) {
        console.log(error.response?.data || error.message);
        res.status(500).json({ message: "Error deleting post" });
    }
});

app.get("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send("logout failed");
        }
        res.redirect("/");
    })
})


app.listen(port, () => {
    console.log(`server is running on port ${port}`);
});