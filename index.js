const express = require('express');
const app = express()
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const stripe = require('stripe')(process.env.PAYMENT_SECRET)
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
  
    jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
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
    // await client.connect();

    const phonesCollection = client.db('phoneDb').collection('phones')
    const usersCollection = client.db('phoneDb').collection('users')
    const cartsCollections = client.db('phoneDb').collection('carts')
    const reviewCollections = client.db('phoneDb').collection('review')
    const paymantsCollections = client.db('phoneDb').collection('payments')

    app.post('/jwt', (req, res) => {
        const user = req.body;
        const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
          expiresIn: '1h'
        })
        res.send({ token })
      })

    

      app.get('/users', async (req, res) => {
        const result = await usersCollection.find().toArray()
        res.send(result)
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

      app.get('/users/admin/:email', verifyJWT, async (req, res) => {
        const email = req.params.email;
  
        if (req.decoded.email !== email) {
          res.send({ admin: false })
        }
  
        const query = { email: email }
        const user = await usersCollection.findOne(query);
        const result = { admin: user?.role === 'admin' }
        res.send(result);
      })
  

      app.patch('/users/admin/:id', async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) }
        const updateDoc = {
          $set: {
            role: 'admin'
          },
        };
        const result = await usersCollection.updateOne(filter, updateDoc)
        res.send(result)
      })

      app.get('/phones', async (req, res) => { 
        const result = await phonesCollection.find().toArray()
        res.send(result)
      })

      app.get('/myphone', async (req, res) => {
        let query = {};
        if (req.query?.email) {
          query = { email: req.query.email }
        }
        const result = await phonesCollection.find(query).toArray();
        res.send(result)
      })
  

      app.post('/phones',  async (req, res) => {
        const newItem = req.body;
        const result = await phonesCollection.insertOne(newItem)
        res.send(result);
      })

      app.put('/phones/:id', async (req, res) => {
        const id = req.params.id;
        console.log(id)
        const filter = { _id: new ObjectId(id) };
        const options = { upsert: true }
        const updatedClass = req.body;
        const newUpdateClass = {
          $set: {
            phoneName: updatedClass.phoneName,
            image: updatedClass.image,
            price: updatedClass.price,
            email: updatedClass.email,
            features: updatedClass.features,
            category: updatedClass.category,
            
          }
        };
        const result = await phonesCollection.updateOne(filter, newUpdateClass, options)
        res.send(result)
      })

      app.delete('/phones/:id', async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) }
        const result = await phonesCollection.deleteOne(query)
        res.send(result)
      })

      app.get('/carts', verifyJWT, async (req, res) => {
        const email = req.query.email;
        if (!email) {
          res.send([])
        }
  
        const decodedEmail = req.decoded.email;
        if (email !== decodedEmail) {
          return res.status(403).send({ error: true, message: 'porviden access' })
        }
  
        else {
          const query = { email: email };
          const result = await cartsCollections.find(query).toArray()
          res.send(result)
        }
      })
  
      app.post('/carts', async (req, res) => {
        const item = req.body;
        console.log(item)
        const result = await cartsCollections.insertOne(item)
        res.send(result)
      })

      app.delete('/carts/:id', async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) }
        const result = await cartsCollections.deleteOne(query)
        res.send(result)
      })

      app.get('/review', async (req, res) => {
        const result = await reviewCollections.find().toArray()
        res.send(result)
      })



      // payment

      app.post('/create-payment-intent', async (req, res) => {
        const { price } = req.body;
        const amount = parseInt(price * 100);
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: 'usd',
          payment_method_types: ['card']
        });
  
        res.send({
          clientSecret: paymentIntent.client_secret
        })
      })

      app.get('/payments', async (req, res) => {
        let query = {};
        if (req.query?.email) {
          query = { email: req.query.email }
        }
        const result = await paymantsCollections.find(query).sort({ date: -1 }).toArray()
        res.send(result)
      })

      app.post('/payments', async (req, res) => {
        const payment = req.body;
        const insertResult = await paymantsCollections.insertOne(payment);
  
        const query = { _id: { $in: payment.cartItems.map(id => new ObjectId(id)) } }
        const deleteResult = await cartsCollections.deleteMany(query)
  
        res.send({ insertResult, deleteResult });
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