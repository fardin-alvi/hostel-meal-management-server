require('dotenv').config()
const express = require('express')
const cors = require('cors')
const app = express()
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

app.use(cors(
    {
        origin: [
            'http://localhost:5173',
            'https://bunkinn-41df5.web.app',
            'https://bunkinn-41df5.firebaseapp.com'
        ],
        credentials: true
    }
))
app.use(express.json())


app.get('/', async (req, res) => {
    res.send('server is runniung')
})


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@bunkcluster.r4oag.mongodb.net/?retryWrites=true&w=majority&appName=BunkCluster`

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: false,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        

        const userCollection = client.db('BunkInnDB').collection('users')
        const mealCollection = client.db('BunkInnDB').collection('meals')
        const reviewCollection = client.db('BunkInnDB').collection('reviews')
        const packageCollection = client.db('BunkInnDB').collection('package')
        const mealRequestCollection = client.db('BunkInnDB').collection('mealRequest')
        const paymentCollection = client.db('BunkInnDB').collection('payments')
        const upcomingmealCollection = client.db('BunkInnDB').collection('upcoming_meals')

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
                req.decoded = decoded
                next()
            })
        }

        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email
            const query = { email: email }
            const user = await userCollection.findOne(query)
            const isAdmin = user?.role === 'admin'
            if (!isAdmin) {
                return res.status(403).send({ message: 'Forbidden Access' })
            }
            next()
        }

        // user releted api

        app.post('/users', async (req, res) => {
            const user = req.body
            const result = await userCollection.insertOne(user)
            res.send(result)
        })

        app.get('/users/:email', verifyToken, async (req, res) => {
            const useremail = req.params?.email
            const query = { email: useremail }
            const result = await userCollection.findOne(query)
            res.send(result)
        })

        app.get('/users/admin/:email', verifyToken, verifyAdmin, async (req, res) => {
            const email = req.params.email
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'Forbidden Access' })
            }
            const query = { email: email }
            const user = await userCollection.findOne(query)
            let admin = false
            if (user) {
                admin = user?.role == 'admin'
            }
            res.send({ admin })
        })

        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
            const userEmail = req.decoded?.email
            const search = req.query?.search || "";
            const page = parseInt(req.query?.page) || 1;
            const itemsPerPage = 10;
            const skip = (page - 1) * itemsPerPage;

            const query = {
                email: {
                    $ne: userEmail,
                },
                $or: [
                    { name: { $regex: search, $options: "i" } },
                    { email: { $regex: search, $options: "i" } }
                ]
            }
            const totalItems = await userCollection.countDocuments(query);
            const totalPages = Math.ceil(totalItems / itemsPerPage);
            const result = await userCollection
                .find(query)
                .skip(skip)
                .limit(itemsPerPage)
                .toArray()
            res.send({
                data: result,
                currentPage: page,
                totalPages: totalPages,
                totalItems: totalItems
            })
        })


        app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params?.id
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    role: "admin"
                }
            }
            const result = await userCollection.updateOne(filter, updateDoc)
            res.send(result)
        })


        // admin upcoming meal

        app.get('/upcomingmeal/byadmin', async (req, res) => {
            const sort = req.query.sort
            const page = parseInt(req.query?.page) || 1;
            const itemsPerPage = 10;
            const skip = (page - 1) * itemsPerPage;
            let sortedData = {}
            if (sort === 'true') {
                sortedData = { likes: -1 }
            }
            const totalItems = await mealRequestCollection.countDocuments();
            const totalPages = Math.ceil(totalItems / itemsPerPage);
            const result = await upcomingmealCollection
                .find()
                .sort(sortedData)
                .skip(skip)
                .limit(itemsPerPage)
                .toArray()
            res.send({
                data: result,
                currentPage: page,
                totalPages: totalPages,
                totalItems: totalItems
            })
        })

        app.post('/upcoming/meal/byadmin', async (req, res) => {
            const meal = req.body
            const result = await upcomingmealCollection.insertOne(meal)
            res.send(result)
        })

        app.post('/upcomingmeal/byadmin', verifyToken, verifyAdmin, async (req, res) => {
            const meal = req.body;
            const newMeal = { ...meal, _id: new ObjectId(), mealId: meal._id };
            const result = await mealCollection.insertOne(newMeal);
            if (result.insertedId) {
                const query = { _id: new ObjectId(req.body._id) };
                await upcomingmealCollection.deleteOne(query);
            }
            res.send(result);
        });

        app.get('/upcoming/meal/details/:id', async (req, res) => {
            const id = req.params?.id
            const query = { _id: new ObjectId(id) }
            const result = await upcomingmealCollection.findOne(query)
            res.send(result)
        })

        app.patch('/upcomingmeal/like/:id', verifyToken, async (req, res) => {
            const id = req.params?.id
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $inc: { likes: 1 }
            };
            const result = await upcomingmealCollection.updateOne(filter, updateDoc);
            res.send(result)
        });



        //  meals releted api

        app.post('/uploadmeals', verifyToken, verifyAdmin, async (req, res) => {
            const meal = req.body
            const result = await mealCollection.insertOne(meal)
            res.send(result)
        })

        // meals by admin all meal

        app.get('/meals/byadmin',verifyToken,verifyAdmin, async (req, res) => {
            const sort = req.query?.sort;
            const page = parseInt(req.query?.page) || 1;
            const itemsPerPage = 10;
            const skip = (page - 1) * itemsPerPage;

            let sortQuery = {};
            if (sort === 'likes') {
                sortQuery.likes = -1;
            } else if (sort === 'review-count') {
                sortQuery.review_count = -1;
            }

            try {
                const totalItems = await mealCollection.countDocuments();
                const totalPages = Math.ceil(totalItems / itemsPerPage);
                const result = await mealCollection
                    .find()
                    .sort(sortQuery)
                    .skip(skip)
                    .limit(itemsPerPage)
                    .toArray();

                res.send({
                    data: result,
                    currentPage: page,
                    totalPages: totalPages,
                    totalItems: totalItems,
                });
            } catch (error) {
                console.error('Error fetching meals:', error);
                res.status(500).send({ error: 'Failed to fetch meals' });
            }
        });

        app.put('/admin/mealupdate/:id', async (req, res) => {
            const id = req.params.id;
            const updatedMeal = req.body;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: updatedMeal,
            };
            const result = await mealCollection.updateOne(filter, updateDoc);
            res.send(result);
        });

        app.get('/meals', async (req, res) => {
            const search = req.query?.search;

            const category = req.query?.category;
            const price = req.query?.price;

            let query = {};
            if (search) {
                query = {
                    $text: { $search: search, }
                };
            }
            if (category && category !== 'All Categories') {
                query.category = category;
            }

            let setPriceQuery = {};
            if (price === 'Price(low to high)') {
                setPriceQuery.price = 1;
            } else if (price === 'Price(high to low)') {
                setPriceQuery.price = -1;
            }
            
            const result = await mealCollection.find(query).sort({ ...setPriceQuery }).toArray();

            res.send(result);
        });


        app.delete('/meals/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params?.id
            const query = { _id: new ObjectId(id) }
            const result = await mealCollection.deleteOne(query)
            res.send(result)
        })


        app.get('/meal/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await mealCollection.findOne(query)
            res.send(result)
        })


        app.patch('/like/:id', verifyToken, async (req, res) => {
            const id = req.params?.id
            const filter = { _id: new ObjectId(id) };
            const queryfilter = { mealId: id };
            const updateDoc = {
                $inc: { likes: 1 }
            };
            const mealresult = await mealCollection.updateOne(filter, updateDoc);
            const reviewresult = await reviewCollection.updateMany(queryfilter, updateDoc);
            const requestresult = await mealRequestCollection.updateMany(queryfilter, updateDoc);
            res.send({mealresult,reviewresult,requestresult})
        });


        app.post('/review', async (req, res) => {
            const review = req.body
            const result = await reviewCollection.insertOne(review)
            if (result?.insertedId) {
                const mealId = review.mealId
                const filter = { _id: new ObjectId(mealId) };
                const updatedoc = {
                    $inc: { review_count: 1 }
                }
                await mealCollection.updateOne(filter, updatedoc);
                await reviewCollection.updateMany({ mealId }, updatedoc)
                await mealRequestCollection.updateOne({ mealId }, updatedoc);
            }
            res.send(result)
        })

        app.get('/reviews/:id', async (req, res) => {
            const id = req.params.id
            const query = { mealId: id }
            const result = await reviewCollection.find(query).toArray()
            res.send(result)
        })

        // admin can get all review

        app.get('/admin/reviews', verifyToken, verifyAdmin, async (req, res) => {
            const page = parseInt(req.query?.page)
            const itemsPerPage = 10;
            const skip = (page - 1) * itemsPerPage;
            const totalItems = await mealRequestCollection.countDocuments();
            const totalPages = Math.ceil(totalItems / itemsPerPage);
            const result = await reviewCollection
                .find()
                .skip(skip)
                .limit(itemsPerPage)
                .toArray()
            res.send({
                data: result,
                currentPage: page,
                totalPages: totalPages,
                totalItems: totalItems
            })
        })


        app.delete('/admin/review/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params?.id;
            const query = { _id: new ObjectId(id) };

            const review = await reviewCollection.findOne(query);

            const result = await reviewCollection.deleteOne(query);

            if (result?.deletedCount === 1) {
                const mealId = review?.mealId;
                const mealQuery = { _id: new ObjectId(mealId) };

                await mealCollection.updateOne(
                    mealQuery,
                    { $inc: { review_count: -1 } }
                );
                await mealRequestCollection.updateMany(
                    { mealId },
                    { $inc: { review_count: -1 } }
                );
            }

            res.send(result);
        });

        // user getting review releted api

        app.get('/reviewes', async (req, res) => {
            const result = await reviewCollection.find().toArray()
            res.send(result)
        })

        app.get('/reviews/useremail/:email', verifyToken, async (req, res) => {
            const useremail = req.params.email
            const page = parseInt(req.query?.page) || 1;
            const itemsPerPage = 10;
            const skip = (page - 1) * itemsPerPage;
            const query = { email: useremail }
            const totalItems = await mealRequestCollection.countDocuments(query);
            const totalPages = Math.ceil(totalItems / itemsPerPage);
            const result = await reviewCollection
                .find(query)
                .skip(skip)
                .limit(itemsPerPage)
                .toArray()
            res.send({
                data: result,
                currentPage: page,
                totalPages: totalPages,
                totalItems: totalItems,
            })
        })

        app.delete('/reviews/useremail/:email/meal/:id', verifyToken, async (req, res) => {
            const useremail = req.params?.email
            const id = req.params?.id
            const query = { email: useremail, _id: new ObjectId(id) }
            const review = await reviewCollection.findOne(query);
            const result = await reviewCollection.deleteOne(query)

            if (result?.deletedCount === 1) {
                const mealId = review.mealId;
                const updateDoc = { $inc: { review_count: -1 } };

                await mealCollection.updateOne({ _id: new ObjectId(mealId) }, updateDoc);
                await reviewCollection.updateMany({ mealId }, updateDoc);
                await mealRequestCollection.updateOne({ mealId }, updateDoc);

            }
            res.send(result)
        })

        app.patch('/reviews/user/:id', async (req, res) => {
            const {review} = req?.body
            const id = req.params?.id
            const filter = {_id: new ObjectId(id) }
            const updateDoc = {
                $set: { review }, 
            };
            const result = await reviewCollection.updateOne(filter, updateDoc); 
            res.send(result);
        })

        // meal request api

        app.post('/mealrequest', verifyToken, async (req, res) => {
            const mealRequest = req.body
            const result = await mealRequestCollection.insertOne(mealRequest)
            res.send(result)
        })

        // meal request update by admin releted api

        app.get('/admin/mealreq', verifyToken, verifyAdmin, async (req, res) => {
            const search = req.query?.search || "";
            const page = parseInt(req.query?.page) || 1;
            const itemsPerPage = 10;
            const skip = (page - 1) * itemsPerPage;

            let query = {};
            if (search) {
                query = {
                    $or: [
                        { requested_user_name: { $regex: search, $options: "i" } },
                        { requested_user: { $regex: search, $options: "i" } }
                    ]
                };
            }
            const totalItems = await mealRequestCollection.countDocuments(query);
            const totalPages = Math.ceil(totalItems / itemsPerPage);
            const result = await mealRequestCollection
                .find(query)
                .skip(skip)
                .limit(itemsPerPage)
                .toArray();

            res.send({
                data: result,
                currentPage: page,
                totalPages: totalPages,
                totalItems: totalItems,
            });
        });


        app.patch('/mealreq/user/:email/meal/:id', verifyToken, async (req, res) => {
            const email = req.params?.email
            const id = req.params?.id
            const filter = { requested_user: email, _id: new ObjectId(id) }
            const updateDoc = { $set: { status: "delivered" } }
            const result = await mealRequestCollection.updateOne(filter, updateDoc)
            res.send(result)
        })

        // meal request preview by user

        app.get('/mealrequest/user/:email', verifyToken, async (req, res) => {
            const reqemail = req.params?.email
            const page = parseInt(req.query?.page) || 1;
            const itemsPerPage = 10;
            const skip = (page - 1) * itemsPerPage;
            const query = { requested_user: reqemail }
            const totalItems = await mealRequestCollection.countDocuments(query);
            const totalPages = Math.ceil(totalItems / itemsPerPage);
            const result = await mealRequestCollection
                .find(query)
                .skip(skip)
                .limit(itemsPerPage)
                .toArray()
            res.send({
                data: result,
                currentPage: page,
                totalPages: totalPages,
                totalItems: totalItems
            })
        })

        app.delete('/mealreq/useremail/:email/meal/:id', verifyToken, async (req, res) => {
            const reqemail = req.params?.email
            const id = req.params.id
            const query = { requested_user: reqemail, _id: new ObjectId(id) }
            const result = await mealRequestCollection.deleteOne(query)
            res.send(result)
        })

        // package releted api

        app.get('/package', async (req, res) => {
            const result = await packageCollection.find().toArray()
            res.send(result)
        })

        app.get('/package/:id', verifyToken, async (req, res) => {
            const id = req.params?.id
            const query = { _id: new ObjectId(id) }
            const result = await packageCollection.findOne(query)
            res.send(result)
        })


        // payments releted isssue

        app.post('/payment-intent-method', async (req, res) => {
            const { price } = req.body
            const payment = parseInt(price?.replace("$", "")) * 100
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
            if (result?.insertedId) {
                const filter = { email: payment?.email }
                const updateDoc = {
                    $set: {
                        subscription: payment?.subscription
                    }
                }
                await userCollection.updateOne(filter, updateDoc)
            }
            res.send(result)
        })

        app.get('/paymentInfo/:email', verifyToken, async (req, res) => {
            const useremail = req.params.email
            const query = { email: useremail }
            const result = await paymentCollection.findOne(query)
            res.send(result)
        })

        // statistics for admin

        app.get('/admin-stats', verifyToken, verifyAdmin, async (req, res) => {
            const totalUsers = await userCollection.estimatedDocumentCount();
            const totalMeals = await mealCollection.estimatedDocumentCount();
            const totalMealRequests = await mealRequestCollection.estimatedDocumentCount();
            res.send({ totalUsers, totalMeals, totalMealRequests });
        });

        app.get('/admin-mealChart', verifyToken, verifyAdmin, async (req, res) => {
            const pipeline = [
                {
                    $addFields: {
                        requestDate: {
                            $dateFromString: {
                                dateString: "$requestTime"
                            }
                        }
                    }
                },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: "%m", date: "$requestDate" }
                        },
                        count: { $sum: 1 }
                    }
                },
                {
                    $sort: { _id: 1 }
                }
            ];
            const result = await mealRequestCollection.aggregate(pipeline).toArray();
            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const formattedResult = result.map(item => ({
                month: monthNames[parseInt(item._id) - 1],
                count: item.count
            }));
            res.send(formattedResult);
        });

        

        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // await client.close();
    }
}
run().catch(console.dir);


app.listen(port, () => {
    console.log('port is runng', port);
})