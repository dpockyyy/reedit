require('dotenv').config()

const express = require('express')
const app = express()
const port = process.env.PORT || 3000;
const expressLayouts = require ('express-ejs-layouts')
const methodOverride = require('method-override')
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
    secret: process.env.SECRET || 'mistyrose',
    resave: false,
    saveUninitialized: true
}))

app.use(setCurrentUser)

app.use(express.urlencoded({ extended: true}))

let currentUser = ''

app.get('/', (req, res) => {
    res.redirect('/posts')
})


app.get('/posts', (req, res) => {
    currentUser = res.locals.currentUser
    db.query(`SELECT * FROM posts ORDER BY time DESC;`, (err, result) => {
        if (err) {
            console.log(err)
        }
        let posts = result.rows
        let sql = `
        SELECT * FROM votetracker WHERE post_id = $1 AND username = $2;
        `
        
        for (let post of posts) {
        db.query(sql, [post.id, currentUser], (err, result) => {
                if (currentUser) {
                    if (err) {
                        console.log(err)
                    } else if (result.rowCount === 1 && result.rows[0].vote === 'up') {
                        post.upVote = `https://i.postimg.cc/5NRQrjT8/uptick-toggled.png`
                        post.downVote = `https://i.postimg.cc/VNHH2sYp/downtick.png`
                    } else if (result.rowCount === 1 && result.rows[0].vote === 'down') {
                        post.upVote = `https://i.postimg.cc/52bGCk77/uptick.png`
                        post.downVote = `https://i.postimg.cc/qv66H4HS/downtick-toggled.png`
                    } else {
                        post.upVote = `https://i.postimg.cc/52bGCk77/uptick.png`
                        post.downVote = `https://i.postimg.cc/VNHH2sYp/downtick.png`
                    }
                } else {
                    post.upVote = `https://i.postimg.cc/52bGCk77/uptick.png`
                    post.downVote = `https://i.postimg.cc/VNHH2sYp/downtick.png`
                }
                // console.log(result.rows) 
                // console.log(posts)
            })
        }
        setTimeout(() => {
            res.render('home', {
                posts: posts
            })
            
        }, '200');
        
    })
})

app.get('/posts/new', (req, res) => {
    res.render('new')
})

app.locals.timeDifference = function (currDate) {
    let date = new Date();
    date = new Date(date.toISOString().slice(0, 19).replace('T', ' '))
    let diff = date - currDate
    let seconds = diff/1000
    if (seconds < 60) {
        return '<1 min ago'
    } else if (seconds / 60 < 60) {
        return `${Math.round(seconds/60)} mins ago`
    } else if (seconds / 60 / 60 < 24) {
        if (seconds/60/60 <= 1) {
            return `${Math.ceil(seconds/60/60)} hr ago`
        } else {
            return `${Math.ceil(seconds/60/60)} hrs ago`
        }
    } else if (seconds / 60 / 60 / 24 < 30) {
        if (seconds/ 60/ 60/ 24 <= 1) {
            return `${Math.ceil(seconds/60/60/24)} day ago`
        } else {
            return `${Math.ceil(seconds/60/60/24)} days ago`
        }
    } else if (seconds / 60 / 60 / 24 / 30 < 12) {
        if (seconds/ 60 / 60 / 24 / 30 <= 1) {
            return `${Math.ceil(seconds/60/60/24/30)} month ago`
        } else {
            return `${Math.ceil(seconds/60/60/24/30)} months ago`
        }
       
    } else {
        if (seconds/ 60 / 60 / 24 / 30 / 12 <= 1) {
            return `${Math.ceil(seconds/60/60/24/30/12)} year ago`
        } else {
            return `${Math.ceil(seconds/60/60/24/30/12)} years ago`
        }
    }
}



app.post('/posts', (req, res) => {
    let currentDate = new Date();
    let title = req.body.title
    let imageUrl = req.body.image_url
    let description = req.body.description
    let username = req.session.username
    let subreedit = req.body.subreedit
    let upvotes = req.body.upvotes
    let time = currentDate.toISOString().slice(0, 19).replace('T', ' ')

    if (req.body.title === '' || req.body.subreedit === '') {
        res.redirect('/posts/new')
    } else {
        const sql = `
        INSERT INTO posts
        (title, upvotes, image_url, description, username, subreedit, time)
        VALUES
        ($1, $2, $3, $4, $5, $6, $7);
        `
    
        db.query(sql, [title, upvotes, imageUrl, description, username, subreedit, time], (err, result) => {
            if (err) {
                console.log(err) 
            }
            res.redirect('/posts')
        })
    }
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

    if (title === '') {
        res.redirect(`/posts/${req.params.id}/edit`)
    } else {
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
    }
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
        
            let sql = `
            SELECT * FROM votetracker WHERE post_id = $1 AND username = $2;
            `

            db.query(sql, [post.id, currentUser], (err, result) => {
                if (currentUser) {
                    if (err) {
                        console.log(err)
                    } else if (result.rowCount === 1 && result.rows[0].vote === 'up') {
                        post.upVote = `https://i.postimg.cc/5NRQrjT8/uptick-toggled.png`
                        post.downVote = `https://i.postimg.cc/VNHH2sYp/downtick.png`
                    } else if (result.rowCount === 1 && result.rows[0].vote === 'down') {
                        post.upVote = `https://i.postimg.cc/52bGCk77/uptick.png`
                        post.downVote = `https://i.postimg.cc/qv66H4HS/downtick-toggled.png`
                    } else {
                        post.upVote = `https://i.postimg.cc/52bGCk77/uptick.png`
                        post.downVote = `https://i.postimg.cc/VNHH2sYp/downtick.png`
                    }
                } else {
                    post.upVote = `https://i.postimg.cc/52bGCk77/uptick.png`
                    post.downVote = `https://i.postimg.cc/VNHH2sYp/downtick.png`
                }
                // console.log(result.rows) 
                // console.log(posts)
                setTimeout(() => {
                    res.render('show', {
                    post: post,
                    comments: comments,
                }) 
            }, '200');
            })
            
        })
    })
})

app.delete('/posts/:id', (req, res) => {
    let id = req.params.id
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
        let sql = `
        DELETE FROM votetracker 
        WHERE post_id = $1
        `
        db.query(sql, [id], (err, result) => {
            if (err) {
                console.log(err)
            }
            res.redirect('/')
        })
    })
})


app.get('/user/:username', (req, res) => {
    let user = req.params.username

    let sql = `
    SELECT * FROM posts
    WHERE username = $1
    ORDER BY time DESC;
    `
    currentUser = res.locals.currentUser

    db.query(sql, [user], (err, result) => {
        if (err) {
            console.log(err)
        }
        let posts = result.rows

        let sql = `
        SELECT * FROM votetracker WHERE post_id = $1 AND username = $2;
        `
        
        for (let post of posts) {
        db.query(sql, [post.id, currentUser], (err, result) => {
                if (currentUser) {
                    if (err) {
                        console.log(err)
                    } else if (result.rowCount === 1 && result.rows[0].vote === 'up') {
                        post.upVote = `https://i.postimg.cc/5NRQrjT8/uptick-toggled.png`
                        post.downVote = `https://i.postimg.cc/VNHH2sYp/downtick.png`
                    } else if (result.rowCount === 1 && result.rows[0].vote === 'down') {
                        post.upVote = `https://i.postimg.cc/52bGCk77/uptick.png`
                        post.downVote = `https://i.postimg.cc/qv66H4HS/downtick-toggled.png`
                    } else {
                        post.upVote = `https://i.postimg.cc/52bGCk77/uptick.png`
                        post.downVote = `https://i.postimg.cc/VNHH2sYp/downtick.png`
                    }
                } else {
                    post.upVote = `https://i.postimg.cc/52bGCk77/uptick.png`
                    post.downVote = `https://i.postimg.cc/VNHH2sYp/downtick.png`
                }
                // console.log(result.rows) 
                // console.log(posts)
            })
        }
        setTimeout(() => {
            res.render('user', {
                posts: posts
            })
            
        }, '200');
    })
})

app.get('/r/:subreedit', (req, res) => {
    let subreedit = req.params.subreedit

    let sql = `
    SELECT * FROM posts 
    WHERE subreedit = $1
    ORDER BY time DESC;
    `
    currentUser = res.locals.currentUser

    db.query(sql, [subreedit], (err, result) => {
        if (err) {
            console.log(err)
        }
        let posts = result.rows

        let sql = `
        SELECT * FROM votetracker WHERE post_id = $1 AND username = $2;
        `
        
        for (let post of posts) {
        db.query(sql, [post.id, currentUser], (err, result) => {
                if (currentUser) {
                    if (err) {
                        console.log(err)
                    } else if (result.rowCount === 1 && result.rows[0].vote === 'up') {
                        post.upVote = `https://i.postimg.cc/5NRQrjT8/uptick-toggled.png`
                        post.downVote = `https://i.postimg.cc/VNHH2sYp/downtick.png`
                    } else if (result.rowCount === 1 && result.rows[0].vote === 'down') {
                        post.upVote = `https://i.postimg.cc/52bGCk77/uptick.png`
                        post.downVote = `https://i.postimg.cc/qv66H4HS/downtick-toggled.png`
                    } else {
                        post.upVote = `https://i.postimg.cc/52bGCk77/uptick.png`
                        post.downVote = `https://i.postimg.cc/VNHH2sYp/downtick.png`
                    }
                } else {
                    post.upVote = `https://i.postimg.cc/52bGCk77/uptick.png`
                    post.downVote = `https://i.postimg.cc/VNHH2sYp/downtick.png`
                }
                // console.log(result.rows) 
                // console.log(posts)
            })
        }
        setTimeout(() => {
            res.render('subreedit', {
                posts: posts
            })
            
        }, '200');
    })
    
})


app.post('/comments', (req, res) => {
    // console.log(req.body)
    // console.log(req.body.postId)
    let currentDate = new Date();
    let postId = req.body.postId
    let description = req.body.description
    let user = res.locals.currentUser
    let time = currentDate.toISOString().slice(0, 19).replace('T', ' ')
    const sql = `INSERT INTO comments
    (post_id, description, username, time)
    VALUES ($1, $2, $3, $4);
    `

    db.query(sql, [postId, description, user, time], (err, result) => {
        if (err) {
            console.log(err)
        }
        res.redirect(`/posts/${postId}`)
    })
} )









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


    if(user === '' || email === '' || plainTextPass === '') {
        res.redirect('/signup')
    } else {
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
                        console.log(result)
                        console.log(result.rows[0].username)
                        req.session.userId = result.rows[0].id
                        req.session.username = user
                        res.redirect('/')
                    }
                })
            })
        })
    }
})

app.post('/upvote', ensureLoggedIn, (req, res) => {

    let id = req.body.postId
    let user = res.locals.currentUser
    
    let sql = `
    SELECT * FROM votetracker
    WHERE post_id = $1 AND username = $2;
    `

    console.log(req)

    db.query(sql, [id, user], (err, result) => {
        if (err) {
            console.log(err)
        } else if (result.rowCount === 0) {
            db.query(`INSERT INTO votetracker (post_id, username, vote) values ($1, $2, 'up');`, [id, user], (err, result) => {
                db.query(`SELECT * FROM posts where id = ${id};`, (err, result) => {
                    if (err) {
                        console.log(err)
                    } 
                    // console.log(result)
                    let upvotes = result.rows[0].upvotes
                    upvotes++

                    // console.log(upvotes)
                    db.query(`UPDATE posts SET upvotes = $1 WHERE id = $2;`, [upvotes, id], (err, result) => {
                        if (err) {
                            console.log(err)
                        } else {
                            res.redirect('/posts')
                        }
                    })
                })
            })
        } else if (result.rows[0].vote === "down") {
            db.query(`UPDATE votetracker SET vote = 'up' WHERE post_id = ${id};`,  (err, result) => {
                if (err)  {
                    console.log(err)
                }   
                db.query(`SELECT * FROM posts where id = ${id};`, (err, result) => {
                    if (err) {
                        console.log(err)
                    } 
                    let upvotes = result.rows[0].upvotes
                    upvotes += 2
    
                    console.log(upvotes)
                    db.query(`UPDATE posts SET upvotes = $1 WHERE id = $2;`, [upvotes, id], (err, result) => {
                        if (err) {
                            console.log(err)
                        } else {
                            res.redirect('/posts')
                        }
                    })
                })
            })
        } else {
            db.query(`DELETE FROM votetracker where post_id = $1 AND username = $2 AND vote = 'up';`, [id, user], (err, result) => {
                if (err)  {
                    console.log(err)
                }   
                db.query(`SELECT * FROM posts where id = ${id};`, (err, result) => {
                    if (err) {
                        console.log(err)
                    } 
                    let upvotes = result.rows[0].upvotes
                    upvotes--
    
                    console.log(upvotes)
                    db.query(`UPDATE posts SET upvotes = $1 WHERE id = $2;`, [upvotes, id], (err, result) => {
                        if (err) {
                            console.log(err)
                        } else {
                            res.redirect('/posts')
                        }
                    })
                })
            })
        } 
    })
})

app.post('/downvote', ensureLoggedIn, (req, res) => {

    let id = req.body.postId
    let user = res.locals.currentUser
    
    let sql = `
    SELECT * FROM votetracker
    WHERE post_id = $1 AND username = $2;
    `


    db.query(sql, [id, user], (err, result) => {
        if (err) {
            console.log(err)
            console.log(result)
        } else if (result.rowCount === 0) {
            db.query(`INSERT INTO votetracker (post_id, username, vote) values ($1, $2, 'down');`, [id, user], (err, result) => {
                if (err) {
                    console.log(err)
                }
                db.query(`SELECT * FROM posts where id = ${id};`, (err, result) => {
                    if (err) {
                        console.log(err)
                    } 
                    console.log(result)
                    let upvotes = result.rows[0].upvotes
                    upvotes--

                    console.log(upvotes)
                    db.query(`UPDATE posts SET upvotes = $1 WHERE id = $2;`, [upvotes, id], (err, result) => {
                        if (err) {
                            console.log(err)
                        } else {
                            res.redirect('/posts')
                        }
                    })
                })
            })
        } else if(result.rows[0].vote === "up") {
            db.query(`UPDATE votetracker SET vote = 'down' WHERE post_id = ${id};`,  (err, result) => {
                if (err)  {
                    console.log(err)
                }   
                db.query(`SELECT * FROM posts where id = ${id};`, (err, result) => {
                    if (err) {
                        console.log(err)
                    } 
                    let upvotes = result.rows[0].upvotes
                    upvotes -= 2
    
                    console.log(upvotes)
                    db.query(`UPDATE posts SET upvotes = $1 WHERE id = $2;`, [upvotes, id], (err, result) => {
                        if (err) {
                            console.log(err)
                        } else {
                            res.redirect('/posts')
                        }
                    })
                })
            })
        }else {
            db.query(`DELETE FROM votetracker where post_id = $1 AND username = $2 AND vote ='down';`, [id, user], (err, result) => {
                if (err)  {
                    console.log(err)
                }   
                db.query(`SELECT * FROM posts where id = ${id};`, (err, result) => {
                    if (err) {
                        console.log(err)
                    } 
                    let upvotes = result.rows[0].upvotes
                    upvotes++
    
                    console.log(upvotes)
                    db.query(`UPDATE posts SET upvotes = $1 WHERE id = $2;`, [upvotes, id], (err, result) => {
                        if (err) {
                            console.log(err)
                        } else {
                            res.redirect('/posts')
                        }
                    })
                })
            })
        } 
    })
})

app.get('/loginprompt', (req, res) => {
    res.render('loginprompt')
})




app.listen(port, () => {
    console.log(`server listening on port ${port}`)
})