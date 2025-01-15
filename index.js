const express = require('express')
const cors = require('cors')
const app = express()
const port = process.env.PORT || 5000
require('dotenv').config()
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

        app.post('/users', async (req, res) => {
            const user = req.body
            const result = await userCollection.insertOne(user)
            res.send(result)
        })

        app.get('/meals', async (req, res) => {
            const result = await mealCollection.find().toArray()
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