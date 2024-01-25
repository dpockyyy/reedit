function ensureLoggedIn(req, res, next) {
    if (req.session.userId) {
        next()
    } else {
        res.redirect('/loginprompt')
    }
}

module.exports = ensureLoggedIn