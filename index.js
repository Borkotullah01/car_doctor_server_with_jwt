const express = require('express')
const jwt = require('jsonwebtoken')
const cookieParser = require("cookie-parser")
const cors = require('cors')
const app = express()
const port = process.env.PORT || 5000
require('dotenv').config()

// middle ware
app.use(express.json())
app.use(cookieParser())
app.use(cors({
  origin: ["http://localhost:5173"],
  credentials: true
}))


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.elpbg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const logger = (req, res, next) => {
  console.log(`http://${req.hostname}:${port}${req.originalUrl}`)
  next()
}

const verifyToken = (req, res, next) => {
  console.log("verify cookies",req.cookies)
  console.log(req.user)
  const token = req.cookies?.cookie;
  if (!token) {
    return res.status(401).send({message: "unauthorized"})
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded)=> {
    if (err) {
      return res.status(401).send({message: "unauthorized"})
    }
    req.user = decoded;
  });
  next()
}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    const carDoctor = client.db("carDoctor");
    const services = carDoctor.collection("services");
    const bookings = carDoctor.collection("bookings");

    app.get('/', (req, res) => res.send('Welcome to Car Doctor server'))

    app.post('/jwt', (req, res)=>{
      const user = req.body;
      console.log("user jwt:",user)
      const Token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "1h" });
      console.log("Token from jwt post route:", Token)

      res
      .cookie("cookie", Token, {
        httpOnly: true,
        secure:true,
        sameSite: "none"
      })
      .send({cookie_success: true})
      
    })

    app.get('/services', logger, verifyToken, async(req, res) => {
        const cursor = services.find({})
        console.log("service route cookies:",req.cookies)
        const result = await cursor.toArray()
      res.send(result)
    })
    
    app.get('/service/:id', async(req, res) => {
        const id = req.params.id
        const query = {_id: new ObjectId(id)}
        const options = {
          projection: {_id: 1, title: 1, price: 1, img: 1}
        }
        const result = await services.findOne(query, options)
      res.send(result)
    })

    app.get('/bookings', logger, verifyToken, async (req, res)=> {
      console.log("booking cookies:",req.cookies)
      console.log("Bookings user", req.user)
      if (req.user?.email !== req.query?.email) {
        return res.status(401).send({message: "unauthorized"})
      }
      let query = {}
      if (req.query?.email) {
        query = {email: req.query.email}
      }
      const result = await bookings.find(query).toArray()
      res.send(result)
    })
    app.post('/bookings', async (req, res)=> {
      const booking = req.body
      const result = await bookings.insertOne(booking)
      res.send(result)
    })

    app.delete('/delete/:id', async (req, res) => {
      const id = req.params.id
      const query = {_id: new ObjectId(id)}
      const result = await bookings.deleteOne(query)
      res.send(result)
    })
    app.patch('/bookings/confirm/:id', async (req, res) => {
      const id = req.params.id
      const updateBooking = req.body;
      const query = {_id: new ObjectId(id)}
      const updateDock = {
        $set: {
          status: updateBooking.status
        }
      }
      const result = await bookings.updateOne(query, updateDock)
      res.send(result)
    })

    app.listen(port, () => console.log(`Your car doctor server is running on http://localhost:${port}`))

  } finally {
    // await client.close();
  }
}
run().catch(console.dir);
