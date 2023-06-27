const express = require('express');
const app = express()
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = process.env.PORT || 5000;

app.use(cors())
app.use(express.json())

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
      return res.status(401).send({ error: true, message: 'Unauthorized access' });
    }
    // bearer token
    const token = authorization.split(' ')[1];
  
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
      if (err) {
        return res.status(401).send({ error: true, message: 'Unauthorized access' })
      }
      req.decoded = decoded;
      next();
    })
  }


const uri = `mongodb+srv://${process.env.DB_user}:${process.env.DB_pass}@cluster0.frc6p9l.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const phonesCollection = client.db('phoneDb').collection('phones')
    const usersCollection = client.db('phoneDb').collection('users')

    app.post('/jwt', (req, res) => {
        const user = req.body;
        const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
          expiresIn: '1h'
        })
        res.send({ token })
      })

    app.post('/users', async (req, res) => {
        const user = req.body;
        const query = { email: user.email }
        const existingUser = await usersCollection.findOne(query)
        if (existingUser) {
          return res.send({ message: 'User already exist' })
        }
        const result = await usersCollection.insertOne(user)
        res.send(result)
      })

      app.get('/phones', async (req, res) => { 
        const result = await phonesCollection.find().toArray()
        res.send(result)
      })





    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('phone palace is running....')
  })
  
  app.listen(port, () => {
    console.log(`phone palace is running on port ${port}`)
  })