var express = require("express");
var app = express();
app.use(express.json()); 
const cors = require('cors');

app.use(cors());

// const userRoutes = require('./routes/_userRoutes').router;
// app.use(userRoutes);

// Define a port to listen to
const PORT = process.env.PORT || 8081;
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = "mongodb+srv://EDGEBugRacket:4kqSP0Md2OlEps9k@bugracket.kc2nsam.mongodb.net/?retryWrites=true&w=majority";
const mongoClient = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// Imports the Google Cloud client library
const vision = require('@google-cloud/vision');

//Use the service credential to enable vision api
const serviceAccountPath = './credentials/laundrycamera-03a269f4aeb5.json';

// Creates a client
const client = new vision.ImageAnnotatorClient({
    keyFilename: serviceAccountPath,
});

async function detectTextInImage(imagePath) {
  // Performs text detection on the image file
  const [result] = await client.textDetection(imagePath);
  const detections = result.textAnnotations;
  let texts = [];

  detections.forEach((text, index) => {
    if (index === 0) {
      texts.push({ fullText: text.description });
    } else {
      texts.push({ description: text.description, vertices: text.boundingPoly.vertices });
    }
  });

  return texts;
}

// Example usage
const imagePaths = {
    1 : "./data/sample-laundry-screen-1.jpg",
    2 : "./data/sample-laundry-screen-2.jpg",
    3 : "./data/sample-laundry-screen-3.jpg",
    4 : "./data/sample-laundry-screen-4.jpg"
}

// Add a basic route for testing the server
app.get('/', function(req, res){
    res.send('Hello World (First Update)!');
});

app.get('/test', async function(req, res) {
    try {
        const imageId = req.query.id || 1;

        const imagePath = imagePaths[Number(imageId)];
        if (!imagePath) {
          return res.status(404).send('Image not found');
        }

        const texts = await detectTextInImage(imagePath);
        res.status(200).json(texts);
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred');
    }
});

// Start the server
app.listen(PORT, function(){
    console.log(`Server is running on port ${PORT}.`);
    console.log('Navigate to http://localhost:' + PORT + ' in your browser to check it locally.');
    console.log('If deployed, check your Google App Engine URL.');
});