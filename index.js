const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const PDFDocument = require("pdfkit");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET_KEY = "your_secret_key"; 

// Middleware
app.use(cors());
app.use(express.json());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Database connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root", 
  password: "Jag19@root", 
  database: "notes_db",
});

db.connect((err) => {
  if (err) {
    console.error("Database connection failed:", err);
    return;
  }
  console.log("Connected to MySQL database");
});

// Default route
app.get("/", (req, res) => {
  res.send("Notes App Backend is Running!");
});

// CRUD Operations for Notes
app.get("/notes", (req, res) => {
  const sql = "SELECT * FROM notes";
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(result);
  });
});

app.post("/notes", (req, res) => {
  const { title, content, category } = req.body;
  const sql = "INSERT INTO notes (title, content, category) VALUES (?, ?, ?)";
  db.query(sql, [title, content, category], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Note added successfully", id: result.insertId });
  });
});

// Update Note
app.put("/notes/:id", (req, res) => {
    console.log("Received ID:", req.params.id); // Debugging line

    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
        console.log("Invalid ID detected"); // Debugging line
        return res.status(400).json({ error: "Invalid note ID" });
    }

    const { title, content } = req.body;
    if (!title || !content) return res.status(400).json({ error: "Title and content are required" });

    const sql = "UPDATE notes SET title = ?, content = ?, updated_at = NOW() WHERE id = ?";
    db.query(sql, [title, content, id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Note updated successfully", affectedRows: result.affectedRows });
    });
});


app.delete("/notes/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);

    console.log("Received DELETE request for ID:", id); // Debugging log

    if (isNaN(id) || id <= 0) {
        console.error("Invalid note ID:", id);
        return res.status(400).json({ error: "Invalid note ID" });
    }

    const sql = "DELETE FROM notes WHERE id = ?";
    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error("Database Error:", err.message);
            return res.status(500).json({ error: err.message });
        }

        if (result.affectedRows === 0) {
            console.warn("Note not found with ID:", id);
            return res.status(404).json({ error: "Note not found" });
        }

        console.log("Note deleted successfully with ID:", id);
        res.json({ message: "Note deleted successfully" });
    });
});



app.get("/notes/search", (req, res) => {
    const { query } = req.query;

    if (!query) {
        return res.status(400).json({ error: "Search query is required" });
    }

    const searchQuery = `%${query.toLowerCase()}%`; 

    const sql = `
        SELECT * FROM notes 
        WHERE LOWER(title) LIKE ? OR LOWER(content) LIKE ?
        ORDER BY title ASC;`;

    console.log("Executing SQL Query:", sql, "with params:", searchQuery);

    db.query(sql, [searchQuery, searchQuery], (err, result) => {
        if (err) {
            console.error("Database Error:", err);
            return res.status(500).json({ error: err.message });
        }

        console.log("Search Results:", result); // Debugging output

        if (result.length === 0) {
            return res.status(404).json({ message: "No notes found" });
        }

        res.json(result);
    });
});





// User Signup
app.post("/signup", async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        return res.status(400).json({ error: "All fields are required" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const sql = "INSERT INTO users (username, email, password) VALUES (?, ?, ?)";

    db.query(sql, [username, email, hashedPassword], (err) => {
        if (err) {
            if (err.code === "ER_DUP_ENTRY") {
                return res.status(400).json({ error: "Username or Email already exists" });
            }
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: "User registered successfully" });
    });
});

// User Login
app.post("/login", (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

    const sql = "SELECT * FROM users WHERE email = ?";
    db.query(sql, [email], async (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.length === 0) return res.status(400).json({ error: "Invalid credentials" });

        const user = result[0];
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return res.status(400).json({ error: "Invalid credentials" });

        const token = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: "1h" });
        res.json({ message: "Login successful", token });
    });
});

// Export Note as PDF
app.get("/notes/export/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) return res.status(400).json({ error: "Invalid note ID" });

    const sql = "SELECT * FROM notes WHERE id = ?";
    db.query(sql, [id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.length === 0) return res.status(404).json({ error: "Note not found" });

        const note = result[0];
        const doc = new PDFDocument();
        const filename = `note_${id}.pdf`;

        res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
        res.setHeader("Content-Type", "application/pdf");

        doc.pipe(res);
        doc.fontSize(20).text(note.title, { underline: true });
        doc.moveDown();
        doc.fontSize(14).text(note.content);
        doc.end();
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});