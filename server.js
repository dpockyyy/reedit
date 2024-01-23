const express = require('express')
const app = express()
const port = 8080
const expressLayouts = require ('express-ejs-layouts')
const methodOverride = require('method-override')
require('dotenv').config()
const db = require('./db/index')
const bcrypt = require('bcrypt')
const ensureLoggedIn = require('./middlewares/ensure_logged_in')

const session = require('express-session')
const setCurrentUser = require('./middlewares/set_current_user')

app.use(expressLayouts)
app.use(express.static('public'))

app.use(methodOverride('_method'))
app.set('view engine', 'ejs')

const requestLogger = require('./middlewares/request_logger')
app.use(requestLogger)

app.use(session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: true
}))

app.use(setCurrentUser)

app.use(express.urlencoded({ extended: true}))

app.get('/', (req, res) => {
    res.redirect('/posts')
})

app.get('/posts', (req, res) => {
    db.query(`SELECT * FROM posts;`, (err, result) => {
        if (err) {
            console.log(err)
        }
        let posts = result.rows
        console.log(result.rows)
        res.render('home', {posts: posts})
    })
})

app.get('/posts/new', ensureLoggedIn, (req, res) => {
    res.render('new')
})

app.post('/posts', (req, res) => {
    let title = req.body.title
    let imageUrl = req.body.image_url
    let description = req.body.description
    let username = req.session.username
    let subreedit = req.body.subreedit

    const sql = `
    INSERT INTO posts
    (title, image_url, description, username, subreedit)
    VALUES
    ($1, $2, $3, $4, $5);
    `

    db.query(sql, [title, imageUrl, description, username, subreedit], (err, result) => {
        if (err) {
            console.log(err) 
        }
        res.redirect('/posts')
    })
})

app.get('/posts/:id/edit', (req, res) => {
    console.log('edit')
    const sql = `
    SELECT * FROM posts
    WHERE id = $1;
    `
    db.query(sql, [req.params.id], (err, result) => {
        if (err) {
            console.log(err)
        }
        let post = result.rows[0]
        res.render('edit', {post: post})
    })
})

app.put('/posts/:id', (req, res) => {
    let title = req.body.title
    let imageUrl = req.body.image_url
    let description = req.body.description

    const sql = `
    UPDATE posts
    SET
        title = $1,
        image_url = $2,
        description = $3
    WHERE id = $4;
    `
    db.query(sql, [title, imageUrl, description, req.params.id], (err, result) => {
        if (err) {
            console.log(err)
        }
        res.redirect(`/posts/${req.params.id}`)
    })
})

app.get('/posts/:id', (req, res) => {
    let id = req.params.id

    db.query(`SELECT * FROM posts WHERE id = $1;`, [id], (err, result) => {
        if (err) {
            console.log(err)
        }
        let post = result.rows[0]
        db.query(`SELECT * FROM comments WHERE post_id = $1;`, [id], (err, result) => {
            let comments = result
            console.log(comments)
            res.render('show', {
                post: post,
                comments: comments
            })
        })
    })
})

app.delete('/posts/:id', (req, res) => {
    const sql = `
    DELETE FROM posts
    WHERE id = $1
    RETURNING *;
    `

    db.query(sql, [req.params.id], (err, result) => {
        if (err) {
            console.log(err) 
            res.send("error")
        }
        res.redirect('/')
    })
})

app.post('/comments', (req, res) => {
    console.log(req.body)
    console.log(req.body.postId)
    let postId = req.body.postId
    let description = req.body.description
    let user = res.locals.currentUser

    const sql = `INSERT INTO comments
    (post_id, description, username)
    VALUES ($1, $2, $3);
    `

    db.query(sql, [postId, description, user], (err, result) => {
        if (err) {
            console.log(err)
        }
        res.redirect(`/posts/${postId}`)
    })
} )

app.locals.hasComments = function (id) {
    let sql = `
    SELECT * FROM comments where post_id = $1
    `
    db.query(sql, [id], (err, result) => {
        if (err) {
            console.log(err)
        } else {
            console.log(result)
            if (result.rowCount === 0) {
                return false
            } else {
                return true
            }
        }
    })
}



app.get('/login', (req, res) => {
    res.render('login')
})

app.post('/login', (req, res) => {

    const sql = `
    SELECT * FROM users
    WHERE email = $1;
    `

    db.query(sql, [req.body.email], (err, result) => {
        if (err) {
            console.log(err)
        }
        
        if (result.rows.length === 0) {
            res.render('login')
            return
        }
        const plainTextPass = req.body.password
        const hashedPass = result.rows[0].password_digest
        bcrypt.compare(plainTextPass, hashedPass, (err, isCorrect) => {

            if (!isCorrect) {
                console.log('password does not match')
                res.render('login')
                return
            }
            req.session.userId= result.rows[0].id
            req.session.username = result.rows[0].username
            res.redirect('/')
        })
    })
})

app.delete('/logout', (req, res) => {
    req.session.userId = null
    res.redirect('/')
})

app.get('/signup', (req, res) => {
    res.render('signup')
})

app.post('/users', (req, res) => {
    let user = req.body.username
    let email = req.body.email
    let plainTextPass = req.body.password
    const saltRound = 10

    bcrypt.genSalt(saltRound, (err, salt) => {
        bcrypt.hash(plainTextPass, salt, (err, hashedPass) => {
            const sql = `
                INSERT INTO
                users (username, email, password_digest)
                VALUES
                ($1, $2, $3)
                RETURNING id;
            `
            db.query(sql, [user, email, hashedPass], (err, result) => {
                if (err) {
                    console.log(err)
                } else {
                    console.log('user created!')
                    req.session.userId = result.rows[0].id
                    req.session.username = result.rows[0].username
                    res.redirect('/')
                }
            })
        })
    })
})

app.listen(port, () => {
    console.log(`server listening on port ${port}`)
})