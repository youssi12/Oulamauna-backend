const express = require("express");
const cors = require('cors');
require("dotenv").config();
const cookieParser = require("cookie-parser");
 

// APP
const app = express();


// MIDDELEWARES 
// CORS configuration to allow requests from the frontend
app.use(cors({
  origin: "http://localhost:5173", // أو port تاع React
  credentials: true}));
app.use(express.json())
app.use(cookieParser()); // ← add this


// ROUTES
app.use('/api/auth',require("./routes/auth.route"));
app.use("/api/admin",require("./routes/admin.route"));

 
//ERROR MIDDLEWARES 

app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    return res.status(statusCode).json({
        success: false,
        message,
        statusCode,
    });
});
// SERVER
const PORT = process.env.PORT||"5000";
app.listen(PORT,()=>console.log(`server is running on port: ${PORT}`))