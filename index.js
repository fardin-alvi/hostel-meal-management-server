const express = require('express')
const cors = require('cors')
const app = express()
const port = process.env.PORT || 5000
require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');

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

        app.post('/users', async(req,res)=> {
            const user = req.body
            const result = await userCollection.insertOne(user)
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