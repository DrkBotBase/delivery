exports.requireAuth = (req, res, next) => {
    if (req.session && req.session.user) {
        return next();
    }
    if (req.path.startsWith('/api') || req.xhr) {
        return res.status(401).json({ error: 'No autorizado' });
    }
    res.redirect('/login');
};