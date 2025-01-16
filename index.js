require('dotenv').config()
const express = require('express')
const cors = require('cors')
const app = express()
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

app.use(cors())
app.use(express.json())


app.get('/', async (req, res) => {
    res.send('server is runniung')
})


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@bunkcluster.r4oag.mongodb.net/?retryWrites=true&w=majority&appName=BunkCluster`

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        await client.connect();

        const userCollection = client.db('BunkInnDB').collection('users')
        const mealCollection = client.db('BunkInnDB').collection('meals')
        const userInteractCollection = client.db('BunkInnDB').collection('user_interaction')
        const packageCollection = client.db('BunkInnDB').collection('package')
        const paymentCollection = client.db('BunkInnDB').collection('payments')

        // jwt releted api

        app.post('/jwt', async (req, res) => {
            const user = req.body
            const token = jwt.sign(user, process.env.ACCESS_TOKEN, { expiresIn: '30d' })
            res.send({ token })
        })

        const verifyToken = (req, res, next) => {
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'unAuthorized Access' })
            }
            const token = req.headers.authorization.split(' ')[1];

            jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'unAuthorized Access' })
                }
                req.user = decoded
                next()
            })
        }

        app.post('/users', async (req, res) => {
            const user = req.body
            const result = await userCollection.insertOne(user)
            res.send(result)
        })

        app.get('/meals', async (req, res) => {
            const search = req.query?.search
            const category = req.query?.category
            const price = req.query?.price 
            let query = {}
            if (search) {
                query = {
                    title: {
                    $regex:search, $options:'i'
                }}
            }
            if (category && category !== 'All Categories') {
                query.category = category
            }
            let setPriceQuery = {}
            if (price === 'Price(low to high)') {
                setPriceQuery.price = 1;
            } else if (price === 'Price(high to low)') {
                setPriceQuery.price = -1;
            }
            const result = await mealCollection.find(query).sort(setPriceQuery).toArray()
            res.send(result)
        })

        app.get('/meal/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await mealCollection.findOne(query)
            res.send(result)
        })

        app.patch('/like/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $inc: { likes: 1 }
            };
            const result = await mealCollection.updateOne(filter, updateDoc);
            res.send(result)
        });

        app.get('/package', async (req, res) => {
            const result = await packageCollection.find().toArray()
            res.send(result)
        } )
        app.get('/package/:id', async (req, res) => {
            const id = req.params.id 
            const query = {_id: new ObjectId(id)}
            const result = await packageCollection.findOne(query)
            res.send(result)
        } )


        // review

        app.post('/review', async (req, res) => {
            const review = req.body
            const result = await userInteractCollection.insertOne(review)
            res.send(result)
        })

        app.get('/reviews', async (req, res) => {
            const result = await userInteractCollection.find().toArray()
            res.send(result)
        })

        // payments releted isssue

        app.post('/payments', async (req, res) => {
            const paymentInfo = req.body;
            const result = await paymentCollection.insertOne(paymentInfo)
            res.send(result)
        })

        app.post('/payment-intent-method', async (req, res) => {
            const { price } = req.body
            const payment = parseInt(price*100)
            console.log('recived', payment)
            const paymentIntent = await stripe.paymentIntents.create({
                amount: payment,
                currency: 'usd',
                payment_method_types: ['card']
            })
            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })






        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // await client.close();
    }
}
run().catch(console.dir);


app.listen(port, () => {
    console.log('port is runng', port);
})