const bcrypt = require('bcrypt')
require('dotenv').config()
const db = require('./index')

const email ='dp@ga.co'
const plaintextPass = 'pudding'
const saltRound = 10

bcrypt.genSalt(saltRound, (err, salt) => {

    bcrypt.hash(plaintextPass, salt, (err, hashedPass) => {
        const sql = `
            INSERT INTO
            users (email, password_digest)
            VALUES
            ('${email}', '${hashedPass}')
            RETURNING id;
        `

        console.log(hashedPass)
        db.query(sql, (err, result) => { 
            if (err) {
                console.log(err)
            } else {
                console.log('user created!')
                console.log(result.rows)
            }
        })
    })
})
