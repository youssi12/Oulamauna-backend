const express = require("express");
require("dotenv").config();
const cookieParser = require("cookie-parser");
 

// APP
const app = express();


// MIDDELEWARES 
app.use(express.json())
app.use(cookieParser()); // ← add this


// ROUTES
app.use('/api/auth',require("./routes/auth.route"));
app.use("/api/admin",require("./routes/admin.route"));

 
//ERROR MIDDLEWARES 


// SERVER
const PORT = process.env.PORT||"5444";
app.listen(PORT,()=>console.log(`server is running on port: ${PORT}`))