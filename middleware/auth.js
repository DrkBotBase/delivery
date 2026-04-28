const User = require('../models/User');

const requireAuth = (req, res, next) => {
    if (req.session && req.session.userId) {
        return next();
    }
    if (req.path.startsWith('/api') || req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
        return res.status(401).json({ error: 'Sesión expirada o no autorizada', redirect: '/auth/login' });
    }
    res.redirect('/auth/login');
};

const requireAdmin = async (req, res, next) => {
    try {
        const user = await User.findById(req.session.userId);
        
        if (!user) {
            return res.status(401).json({ error: 'Usuario no encontrado' });
        }
        
        if (user.role !== 'admin') {
            return res.status(403).json({ 
                error: 'Acceso denegado. Se requieren permisos de administrador.' 
            });
        }
        
        next();
    } catch (error) {
        console.error('Error en requireAdmin:', error);
        res.status(500).json({ error: 'Error verificando permisos' });
    }
};


module.exports = { requireAuth, requireAdmin };