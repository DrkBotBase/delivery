const requireAuth = (req, res, next) => {
    if (req.session && req.session.userId) {
        return next();
    }
    if (req.path.startsWith('/api') || req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
        return res.status(401).json({ error: 'Sesión expirada o no autorizada', redirect: '/auth/login' });
    }
    res.redirect('/auth/login');
};

module.exports = { requireAuth };