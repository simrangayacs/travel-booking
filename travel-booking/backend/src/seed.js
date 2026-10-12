app.get('/api/search', async (req, res) => {
  try {
    const { from, destination } = req.query;
    
    // Direct Collection Query (Case-Insensitive Regex)
    const db = mongoose.connection.db;

    let flightFilter = {};
    let trainFilter = {};

    if (destination) {
      flightFilter.to = { $regex: new RegExp(destination, 'i') };
      trainFilter.to = { $regex: new RegExp(destination, 'i') };
    }

    if (from) {
      flightFilter.from = { $regex: new RegExp(from, 'i') };
      trainFilter.from = { $regex: new RegExp(from, 'i') };
    }

    const flights = await db.collection('flights').find(flightFilter).toArray();
    const trains = await db.collection('trains').find(trainFilter).toArray();

    res.json({ flights, trains });
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ error: "Search failed" });
  }
});