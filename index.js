require('dotenv').config()
const express = require('express')
const cors = require('cors')
const app = express()
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000
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
        const reviewCollection = client.db('BunkInnDB').collection('reviews')
        const packageCollection = client.db('BunkInnDB').collection('package')
        const mealRequestCollection = client.db('BunkInnDB').collection('mealRequest')
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
                        $regex: search, $options: 'i'
                    }
                }
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
            const id = req.params?.id
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
        })

        app.get('/package/:id', async (req, res) => {
            const id = req.params?.id
            // console.log(id);
            const query = { _id: new ObjectId(id) }
            const result = await packageCollection.findOne(query)
            // console.log("package result",result);
            res.send(result)
        })


        // review & meal request

        app.post('/review', async (req, res) => {
            const review = req.body
            const result = await reviewCollection.insertOne(review)
            res.send(result)
        })

        app.get('/reviews/:id', async (req, res) => {
            const id = req.params.id
            const query = { mealId: id }
            const result = await reviewCollection.find(query).toArray()
            res.send(result)
        })
        app.get('/reviews/:email', async (req, res) => {
            const useremail = req.params.email
            console.log(useremail);
            const query = { email: useremail }
            const result = await reviewCollection.find(query).toArray()
            console.log(result);
            res.send(result)
        })

        app.post('/mealrequest', async (req, res) => {
            const mealRequest = req.body
            const result = await mealRequestCollection.insertOne(mealRequest)
            res.send(result)
        })

        app.get('/mealrequest', async (req, res) => {
            const result = await mealRequestCollection.find().toArray()
            res.send(result)
        })

        app.delete('/mealreq/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await mealRequestCollection.deleteOne(query)
            res.send(result)
        })

        // payments releted isssue

        app.post('/payment-intent-method', async (req, res) => {
            const { price } = req.body
            const payment = parseInt(price?.replace("$",""))*100
            const paymentIntent = await stripe.paymentIntents.create({
                amount: payment,
                currency: 'usd',
                payment_method_types: ['card']
            })
            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })

        app.post('/payments', async (req, res) => {
            const payment = req.body 
            const result = await paymentCollection.insertOne(payment)
            res.send(result)
        })

        app.get('/paymentInfo/:email', async (req, res) => {
            const useremail = req.params.email 
            const query = { email: useremail }
            const result = await paymentCollection.findOne(query)
            res.send(result)
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