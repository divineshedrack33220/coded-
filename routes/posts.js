const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload'); // Assumed middleware for file uploads

// GET all posts
router.get('/', postController.getPosts);

// CREATE a post
router.post(
  '/',
  auth,
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'paymentProof', maxCount: 1 },
  ]),
  postController.createPost
);

// EXTEND a post
router.post('/extend', auth, postController.extendPost);

// GET posts by user ID
router.get('/user/:id', postController.getUserPosts);

// ACCEPT a post request
router.post('/accept', auth, postController.acceptRequest);

module.exports = router;