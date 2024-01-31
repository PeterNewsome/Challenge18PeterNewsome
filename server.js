require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/socialNetworkDB', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Mongoose model for User
const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  thoughts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Thought' }],
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});

userSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

const User = mongoose.model('User', userSchema);

// Mongoose model for Thought
const thoughtSchema = new mongoose.Schema({
  thoughtText: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  username: { type: String, required: true },
  reactions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Reaction' }]
});

const Thought = mongoose.model('Thought', thoughtSchema);

// Mongoose model for Reaction
const reactionSchema = new mongoose.Schema({
  reactionBody: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  username: { type: String, required: true }
});

const Reaction = mongoose.model('Reaction', reactionSchema);

// Middleware for parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// User routes
app.route('/users')
  .get(async (req, res) => {
    const users = await User.find().populate('thoughts').populate('friends');
    res.json(users);
  })
  .post(async (req, res) => {
    const user = await User.create(req.body);
    res.status(201).json(user);
  });

app.route('/users/:userId')
  .put(async (req, res) => {
    const user = await User.findByIdAndUpdate(req.params.userId, req.body, { new: true });
    res.json(user);
  })
  .delete(async (req, res) => {
    await User.findByIdAndDelete(req.params.userId);
    res.status(204).send();
  });

app.post('/users/:userId/friends/:friendId', async (req, res) => {
  const user = await User.findById(req.params.userId);
  user.friends.push(req.params.friendId);
  await user.save();
  res.status(201).json(user);
});

app.delete('/users/:userId/friends/:friendId', async (req, res) => {
  const user = await User.findById(req.params.userId);
  user.friends.pull(req.params.friendId);
  await user.save();
  res.status(204).send();
});

// Thought routes
app.route('/thoughts')
  .get(async (req, res) => {
    const thoughts = await Thought.find().populate('reactions');
    res.json(thoughts);
  })
  .post(async (req, res) => {
    const thought = await Thought.create(req.body);
    res.status(201).json(thought);
  });

app.route('/thoughts/:thoughtId')
  .put(async (req, res) => {
    const thought = await Thought.findByIdAndUpdate(req.params.thoughtId, req.body, { new: true });
    res.json(thought);
  })
  .delete(async (req, res) => {
    await Thought.findByIdAndDelete(req.params.thoughtId);
    res.status(204).send();
  });

app.post('/thoughts/:thoughtId/reactions', async (req, res) => {
  const thought = await Thought.findById(req.params.thoughtId);
  const reaction = await Reaction.create(req.body);
  thought.reactions.push(reaction._id);
  await thought.save();
  res.status(201).json(reaction);
});

app.delete('/thoughts/:thoughtId/reactions/:reactionId', async (req, res) => {
  const thought = await Thought.findById(req.params.thoughtId);
  thought.reactions.pull(req.params.reactionId);
  await thought.save();
  await Reaction.findByIdAndDelete(req.params.reactionId);
  res.status(204).send();
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  });

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  mongoose.connection.once('open', () => {
    console.log('Connected to MongoDB');
  });
});
