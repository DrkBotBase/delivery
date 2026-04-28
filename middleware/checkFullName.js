const User = require('../models/User');

async function checkFullName(req, res, next) {
    try {
        const user = await User.findById(req.session.userId);
        
        if (!user.fullName || user.fullName === null || user.fullName === '') {
            req.session.returnTo = req.originalUrl;
            return res.redirect('/profile/complete');
        }
        
        next();
    } catch (error) {
        console.error("Error verificando nombre:", error);
        next();
    }
}

module.exports = checkFullName;