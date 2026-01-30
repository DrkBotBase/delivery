const requireAuth = (req, res, next) => {
    // 1. Verificar si hay usuario en sesión
    if (req.session && req.session.userId) {
        return next();
    }

    // 2. Si es una petición API (fetch), devolver error JSON en lugar de redirigir
    if (req.path.startsWith('/api') || req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
        return res.status(401).json({ error: 'Sesión expirada o no autorizada', redirect: '/auth/login' });
    }

    // 3. Si es navegación normal, redirigir al login
    res.redirect('/auth/login');
};

module.exports = { requireAuth };