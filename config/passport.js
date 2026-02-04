const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
const { info } = require('../config');

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${info.dominio}/auth/google/callback`,
    proxy: true
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ googleId: profile.id });
        if (user) {
            return done(null, user);
        }
        const email = profile.emails && profile.emails[0].value;
        user = await User.findOne({ email: email });
        if (user) {
            user.googleId = profile.id;
            await user.save();
            return done(null, user);
        }
        const newUser = new User({
            username: profile.displayName,
            email: email,
            googleId: profile.id,
        });
        await newUser.save();
        done(null, newUser);
    } catch (err) {
        console.error(err);
        done(err, null);
    }
  }
));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    User.findById(id).then(user => {
        done(null, user);
    });
});

module.exports = passport;