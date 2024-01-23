function ensureLoggedIn(req, res, next) {
    if (req.session.userId) {
        next()
    } else {
        res.send('sorry please log in first')
    }
}

module.exports = ensureLoggedIn