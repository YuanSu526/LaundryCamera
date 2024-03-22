var express = require("express");
var app = express();
app.use(express.json()); 
const cors = require('cors');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
// Set up multer to store files in memory
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });


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

async function detectTextInImage(imageInput) {
  // Determine whether the input is a Buffer or a path
  const isBuffer = Buffer.isBuffer(imageInput);
  
  const outputDir = './data/adjusted_images';
  fs.mkdirSync(outputDir, { recursive: true });
  
  // If the input is a Buffer, process it directly; otherwise, read from the path
  let processedImage;
  if (isBuffer) {
    processedImage = await sharp(imageInput)
      .greyscale()
      .modulate({ brightness: 1, contrast: 4 })
      .threshold(128)
      .toBuffer();
  } else {
    const adjustedImagePath = path.join(outputDir, `adjusted-${path.basename(imageInput)}`);
    await sharp(imageInput)
      .greyscale()
      .modulate({ brightness: 1, contrast: 4 })
      .threshold(128)
      .toFile(adjustedImagePath);
    processedImage = fs.readFileSync(adjustedImagePath);
  }

  // Now use the processed image (as a Buffer) with the Vision API
  const [result] = await client.textDetection({ image: { content: processedImage } });
  const detections = result.textAnnotations;
  let texts = detections.map(text => ({
    description: text.description,
    vertices: text.boundingPoly ? text.boundingPoly.vertices : []
  }));

  // If processing a file from path, optionally delete the processed file
  if (!isBuffer) {
    fs.unlinkSync(adjustedImagePath); // Clean up if needed
  }

  return texts;
}





// Example usage
const imagePaths = {
    1 : "./data/sample-laundry-screen-1.jpg",
    2 : "./data/sample-laundry-screen-2.jpg",
    3 : "./data/sample-laundry-screen-3.jpg",
    4 : "./data/sample-laundry-screen-4.jpg",
    5 : "./data/sample-laundry-screen-5.jpg"
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


app.get('/checkStatus', async function(req, res) {
  try {
      const imageId = req.query.id || 1;
      const imagePath = imagePaths[Number(imageId)];

      if (!imagePath) {
        return res.status(404).send('Image not found');
      }

      const texts = await detectTextInImage(imagePath);
      const { status, remainingTime } = checkMachineAvailability(texts); // Destructure the returned object
      res.status(200).json({ status, remainingTime }); // Include remainingTime in the response
  } catch (error) {
      console.error(error);
      res.status(500).send('An error occurred');
  }
});

function checkMachineAvailability(detections) {
  let status = "Not Available";
  let remainingTime = "";

  const availablePattern = ["1.25", "125"];
  const donePattern = "00";

  const isAvailable = detections.some(det => availablePattern.includes(det.description));
  if (isAvailable) {
    status = "Available";
  } else {
    // Check if the machine is done
    const isDone = detections.some(det => det.description === donePattern);
    if (isDone) {
      status = "Done";
    } else {
      // If not available nor done, it should be running, so find the remaining time
      const timeDetection = detections.find(det => /^\d{2}$/.test(det.description));
      if (timeDetection) {
        remainingTime = timeDetection.description;
        status = `${remainingTime} minutes remaining`;
      }
    }
  }

  return { status, remainingTime };
}

app.post('/uploadImage', upload.single('image'), async function(req, res) {
  if (!req.file) {
      return res.status(400).send('No image uploaded.');
  }

  try {
      // The image is now available as a buffer in req.file.buffer
      const texts = await detectTextInImage(req.file.buffer);

      // Determine the status based on the detected text
      const { status, remainingTime } = checkMachineAvailability(texts);
      res.status(200).json({ status, remainingTime });
  } catch (error) {
      console.error(error);
      res.status(500).send('An error occurred during text detection.');
  }
});

// Start the server
app.listen(PORT, function(){
    console.log(`Server is running on port ${PORT}.`);
    console.log('Navigate to http://localhost:' + PORT + ' in your browser to check it locally.');
    console.log('If deployed, check your Google App Engine URL.');
});