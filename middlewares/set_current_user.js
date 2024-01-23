const db = require('../db/index')

function setCurrentUser(req, res, next) {
    res.locals.currentUser = null

    // check if this user is logged in
    if (!req.session.userId) {
        return next()
    }
    // set current user
    // lets take the user id to the database
    // to fetch the user record
    const sql = `
        SELECT * FROM users WHERE id = $1;
    `
    db.query(sql, [req.session.userId], (err, result) => {
        // console.log(result.rows)
        res.locals.currentUser = result.rows[0].username
        next()
    })

}

module.exports = setCurrentUser