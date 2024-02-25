const express = require('express')
const app = express()
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
var jwt = require('jsonwebtoken');
const port = process.env.PORT || 3000;
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// Middleware
app.use(cors());
app.use(express.json())

// Verify JWT
const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'Unauthorized Access!' })
    }
    
    const token = authorization.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, (error, decoded) => {
        if (error) {
            return res.status(401).send({ error: true, message: 'Unauthorized access!' })
        }
        req.decoded = decoded;
        next();
    })
}

// Verify Admin
const verifyAdmin = async (req, res, next) => {
    const email = req.decoded.email;
    const query = { email: email };
    const user = await usersCollection.findOne(query);
    if (user?.role !== "admin") {
        return res.status(403).send({ error: true, message: "Forbidden Access" })
    }
    next()
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ftqixdj.mongodb.net/?retryWrites=true&w=majority`;

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
        app.post("/jwt", (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN, { expiresIn: '1h' });
            res.send({ token })
        })

        // Create a classes collection
        const allDataCollection = client.db('CaptureDB').collection('classes')

        // Create A collection for users
        const usersCollection = client.db('CaptureDB').collection('users')

        // Create A collection for selected classes
        const selectedClassCollection = client.db('CaptureDB').collection('selectedClass')

        // Create A collection for Payment
        const paymentsCollection = client.db('CaptureDB').collection('payment')
        
        // Create A collection for Payment
        const newsletterCollection = client.db('CaptureDB').collection('newsletterEmail')

        app.get('/alldata', async (req, res) => {
            const result = await allDataCollection.find().toArray()
            res.send(result);
        })

        // Get user
        app.get("/users", async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        })

        app.post("/users", async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.send(result)
        })

        // Add a class
        app.post("/alldata", async (req, res) => {
            const item = req.body;
            const result = await allDataCollection.insertOne(item);
            res.send(result);
        });

        app.get("/add-class", verifyJWT, async (req, res) => {
            const email = req.query.email;
            const query = { instructor_email: email };

            if (!email) {
                res.send([])
            }
            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: "Forbidden Access" })
            }
            const result = await allDataCollection.find(query).toArray();
            res.send(result)
        })

        //Select class
        app.post("/select-class", async (req, res) => {
            const selectedClass = req.body;
            const result = await selectedClassCollection.insertOne(selectedClass);
            res.send(result)
        })

        app.get('/select-class', async (req, res) => {
            const email = req.query.email;
            const query = { userEmail: email };
            const result = await selectedClassCollection.find(query).toArray();
            res.send(result);

        })

        app.delete('/select-class/:id', async (req, res) => {
            const id = req.params.id;
            const result = await selectedClassCollection.deleteOne({ _id: new ObjectId(id) });
            res.send(result);
        })

        // Approve Class
        app.patch("/alldata/:status", async (req, res) => {
            const status = req.params.status;
            const filter = { class_status: status };
            const updateDoc = {
                $set: {
                    class_status: "approved",
                },
            };
            const result = await allDataCollection.updateOne(filter, updateDoc);
            res.send(result);
        });

        // Denied Class
        app.patch("/deny/:status", async (req, res) => {
            const status = req.params.status;
            const filter = { class_status: status };
            const updateDoc = {
                $set: {
                    class_status: "denied",
                },
            };
            const result = await allDataCollection.updateOne(filter, updateDoc);
            res.send(result);
        });

        // Feedback 
        app.patch("/insertFeedback/:id", async (req, res) => {
            const id = req.params.id;
            const feedback = req.body;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    feedback: feedback,
                },
            };

            const result = await allDataCollection.updateOne(filter, updateDoc);
            res.send(result);
        });

        // MyClasses
        app.get("/myclass", verifyJWT, async (req, res) => {
            const email = req.query.email;
            const query = { instructor_email: email };

            if (!email) {
                res.send([])
            }
            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: "Forbidden Access" })
            }
            console.log(email, query);
            const result = await allDataCollection.find(query).toArray();
            res.send(result)
        })

                // POST METHOD FOR NEWSLETTER
                app.post("/news-letter-email",  async (req, res) => {
                    const { email } = req.body;
                // Check if the email already exists in the database
                    const existingUser = await newsletterCollection.findOne({ email });
                    if (existingUser) {
                        // If the email exists, update the existing user's email
                        await newsletterCollection.updateOne(
                            { email },
                            { $set: { email } }
                        );
                        res.json({ message: 'User email updated successfully' });
                    } else {
                        // If the email doesn't exist, insert a new entry
                        const result = await newsletterCollection.insertOne({ email });
                        res.json(result);
                    }
        
                }),
                // Get Newsletter User
                app.get("/news-letter-email", async (req, res) => {
                    const result = await newsletterCollection.find().toArray();
                    res.send(result);
                })

        //Role Admin
        app.get("/users/admin/:email", verifyJWT,verifyAdmin, async (req, res) => {
            const email = req.params.email;
            if (req.decoded.email !== email) {
                res.send({ admin: false })
            }

            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const result = { admin: user?.role === "admin" }
            res.send(result)
        })

        app.patch("/users/admin/:id", async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: "admin",
                },
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        });

        // Role Instructor
        app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
            const email = req.params.email;
            if (req.decoded.email !== email) {
                res.send({ instructor: false })
            }

            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const result = { instructor: user?.role === "instructor" }
            res.send(result)
        })

        app.patch("/users/instructor/:id", async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: "instructor",
                },
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        });

        // Payment Integration
        app.post("/create-payment-intent", verifyJWT, async (req, res) => {
            const { price } = req.body;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: price * amount,
                currency: "usd",
                payment_method_types: ["card"],
            });
            res.send({ clientSecret: paymentIntent.client_secret });
        });

        app.post("/paymenthistory", verifyJWT, async (req, res) => {
            const payment = req.body;
            const result = await paymentsCollection.insertOne(payment);
            res.send(result);
        });

        app.get("/enrolled-class", async (req, res) => {
            const result = await paymentsCollection.find().sort({ transectionId: -1 }).toArray();
            res.send(result)
        })

        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
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
    res.send('Capture Academy is running!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})