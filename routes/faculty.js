const express = require('express');
const router = express.Router();
const db = require('../db');
const jwt = require('jsonwebtoken');
const authenticateToken = require('./auth');
require('dotenv').config();

// Login route
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  db.query('SELECT * FROM faculty WHERE email = ?', [email], (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err });

    if (results.length === 0) {
      return res.status(401).json({ message: 'No user found' });
    }

    const user = results[0];

    // Directly compare plain text password
    if (password === user.password) {
      const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET);
      return res.json({ 
        token,
        faculty: {
          id: user.id,
          name: user.name,
          email: user.email
        }
      });
    } else {
      return res.status(401).json({ message: 'Incorrect password' });
    }
  });
});

// Get all conferences
router.get('/all-conferences', (req, res) => {
  const query = `
    SELECT c.*, f.name as faculty_name 
    FROM conference c 
    JOIN faculty f ON c.faculty_id = f.id
  `;
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err });
    res.json(results);
  });
});

// Get all journals
router.get('/all-journals', (req, res) => {
  const query = `
    SELECT j.*, f.name as faculty_name 
    FROM journal j 
    JOIN faculty f ON j.faculty_id = f.id
  `;
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err });
    res.json(results);
  });
});

// Get all books
router.get('/all-books', (req, res) => {
  const query = `
    SELECT b.*, f.name as faculty_name 
    FROM book b 
    JOIN faculty f ON b.faculty_id = f.id
  `;
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err });
    res.json(results);
  });
});

// Add conference publication
router.post('/add/conference', authenticateToken, (req, res) => {
  const facultyId = req.user.id;
  const { title, pub_year, location, link, vol, issue, page_no, bibtex, doi } = req.body;
  
  const query = `
    INSERT INTO conference (title, pub_year, location, link, vol, issue, page_no, bibtex, doi, faculty_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  db.query(
    query,
    [title, pub_year, location, link, vol, issue, page_no, bibtex, doi, facultyId],
    (err, result) => {
      if (err) return res.status(500).json({ message: 'Error adding conference', error: err });
      res.json({ message: 'Conference added successfully', id: result.insertId });
    }
  );
});

// Add journal publication
router.post('/add/journal', authenticateToken, (req, res) => {
  const facultyId = req.user.id;
  const { title, pub_year, link, vol, issue, page_no, bibtex, doi } = req.body;
  
  const query = `
    INSERT INTO journal (title, pub_year, link, vol, issue, page_no, bibtex, doi, faculty_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  db.query(
    query,
    [title, pub_year, link, vol, issue, page_no, bibtex, doi, facultyId],
    (err, result) => {
      if (err) return res.status(500).json({ message: 'Error adding journal', error: err });
      res.json({ message: 'Journal added successfully', id: result.insertId });
    }
  );
});

// Add book publication
router.post('/add/book', authenticateToken, (req, res) => {
  const facultyId = req.user.id;
  const { title, chapter, pub_year, link, isbn, vol, issue, page_no, bibtex, doi } = req.body;
  
  const query = `
    INSERT INTO book (title, chapter, pub_year, link, isbn, vol, issue, page_no, bibtex, doi, faculty_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  db.query(
    query,
    [title, chapter, pub_year, link, isbn, vol, issue, page_no, bibtex, doi, facultyId],
    (err, result) => {
      if (err) return res.status(500).json({ message: 'Error adding book', error: err });
      res.json({ message: 'Book added successfully', id: result.insertId });
    }
  );
});

// Get all faculty names
router.get('/all-faculty', (req, res) => {
  const query = 'SELECT id, name FROM faculty ORDER BY name';
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err });
    res.json(results);
  });
});

// Get publications for a specific faculty
router.get('/publications/:facultyId', async (req, res) => {
  try {
    const facultyId = parseInt(req.params.facultyId);
    const year = req.query.year ? parseInt(req.query.year) : null;
    
    console.log('Fetching publications for faculty ID:', facultyId);
    console.log('Filtering by year:', year);

    // First check if faculty exists
    const faculty = await new Promise((resolve, reject) => {
      db.query('SELECT id, name FROM faculty WHERE id = ?', [facultyId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    if (!faculty || faculty.length === 0) {
      return res.status(404).json({ message: 'Faculty not found' });
    }

    // Get all publications in a single query
    const query = `
      SELECT 
        'conference' as type,
        c.title,
        c.pub_year,
        c.location,
        c.link,
        f.name as faculty_name
      FROM conference c
      JOIN faculty f ON c.faculty_id = f.id
      WHERE f.id = ?
      ${year ? 'AND c.pub_year = ?' : ''}
      
      UNION ALL
      
      SELECT 
        'journal' as type,
        j.title,
        j.pub_year,
        NULL as location,
        j.link,
        f.name as faculty_name
      FROM journal j
      JOIN faculty f ON j.faculty_id = f.id
      WHERE f.id = ?
      ${year ? 'AND j.pub_year = ?' : ''}
      
      UNION ALL
      
      SELECT 
        'book' as type,
        b.title,
        b.pub_year,
        NULL as location,
        b.link,
        f.name as faculty_name
      FROM book b
      JOIN faculty f ON b.faculty_id = f.id
      WHERE f.id = ?
      ${year ? 'AND b.pub_year = ?' : ''}
      
      ORDER BY pub_year DESC, title ASC
    `;

    // Prepare query parameters
    const queryParams = year 
      ? [facultyId, year, facultyId, year, facultyId, year]
      : [facultyId, facultyId, facultyId];

    const publications = await new Promise((resolve, reject) => {
      db.query(query, queryParams, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    console.log(`Found ${publications.length} publications for faculty ID ${facultyId}${year ? ` in year ${year}` : ''}`);
    res.json(publications);

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      message: 'Error fetching publications', 
      error: error.message 
    });
  }
});

// Publications route (for logged in faculty)
router.get('/publications', authenticateToken, (req, res) => {
  const facultyId = req.user.id;
  const queries = [
    'SELECT * FROM conference WHERE faculty_id = ?',
    'SELECT * FROM journal WHERE faculty_id = ?',
    'SELECT * FROM book WHERE faculty_id = ?'
  ];

  Promise.all(queries.map(q => new Promise((resolve, reject) => {
    db.query(q, [facultyId], (err, result) => err ? reject(err) : resolve(result));
  })))
    .then(([confs, journals, books]) => res.json({ conferences: confs, journals, books }))
    .catch(err => res.status(500).send(err));
});

// Get publications for a specific year
router.get('/publications-by-year/:year', async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    
    if (isNaN(year) || year < 1900 || year > new Date().getFullYear() + 1) {
      return res.status(400).json({ message: 'Invalid year provided' });
    }

    const query = `
      SELECT 
        'conference' as type,
        c.title,
        c.pub_year,
        c.location,
        c.link,
        f.name as faculty_name
      FROM conference c
      JOIN faculty f ON c.faculty_id = f.id
      WHERE c.pub_year = ?
      
      UNION ALL
      
      SELECT 
        'journal' as type,
        j.title,
        j.pub_year,
        NULL as location,
        j.link,
        f.name as faculty_name
      FROM journal j
      JOIN faculty f ON j.faculty_id = f.id
      WHERE j.pub_year = ?
      
      UNION ALL
      
      SELECT 
        'book' as type,
        b.title,
        b.pub_year,
        NULL as location,
        b.link,
        f.name as faculty_name
      FROM book b
      JOIN faculty f ON b.faculty_id = f.id
      WHERE b.pub_year = ?
      
      ORDER BY title ASC
    `;

    const publications = await new Promise((resolve, reject) => {
      db.query(query, [year, year, year], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    console.log(`Found ${publications.length} publications for year ${year}`);
    res.json(publications);

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      message: 'Error fetching publications', 
      error: error.message 
    });
  }
});

module.exports = router;
