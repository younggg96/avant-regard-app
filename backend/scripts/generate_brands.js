const fs = require('fs');
const path = require('path');

// Read CSV file
const csvPath = path.join(__dirname, '..', 'services', 'processed_brands.csv');
const showsPath = path.join(__dirname, '..', 'services', 'shows.json');
const outputPath = path.join(__dirname, '..', 'src', 'data', 'brands.json');

const csvContent = fs.readFileSync(csvPath, 'utf-8');
const shows = JSON.parse(fs.readFileSync(showsPath, 'utf-8'));

// Create a map of designer name to cover image from shows.json
const designerImageMap = {};
shows.forEach(show => {
  const designer = show.designer;
  if (!designerImageMap[designer] || show.year > (designerImageMap[designer].year || 0)) {
    designerImageMap[designer] = {
      cover_image: show.cover_image,
      year: show.year,
      season: show.season
    };
  }
});

// Parse CSV
const lines = csvContent.split('\n').filter(line => line.trim());
const headers = lines[0].split(',');

const brands = [];

for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) continue;
  
  // Handle CSV with quoted fields
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  
  const [name, category, foundedYear, founder, country, website, _, vogueSlug, vogueUrl] = values;
  
  if (!name) continue;
  
  // Find matching cover image from shows.json
  let coverImage = null;
  let latestSeason = null;
  
  // Try exact match first
  if (designerImageMap[name]) {
    coverImage = designerImageMap[name].cover_image;
    latestSeason = designerImageMap[name].season;
  }
  
  // Try partial matches
  if (!coverImage) {
    for (const [designer, data] of Object.entries(designerImageMap)) {
      if (designer.toLowerCase().includes(name.toLowerCase()) || 
          name.toLowerCase().includes(designer.toLowerCase())) {
        coverImage = data.cover_image;
        latestSeason = data.season;
        break;
      }
    }
  }
  
  brands.push({
    id: i,
    name: name,
    category: category === '无' ? null : category,
    foundedYear: foundedYear === '无' ? null : foundedYear,
    founder: founder === '无' ? null : founder,
    country: country === '无' ? null : country,
    website: website === '无' ? null : website,
    coverImage: coverImage,
    latestSeason: latestSeason,
    vogueSlug: vogueSlug === '无' ? null : vogueSlug,
    vogueUrl: vogueUrl === '无' ? null : vogueUrl
  });
}

// Sort by name
brands.sort((a, b) => a.name.localeCompare(b.name));

// Write output
fs.writeFileSync(outputPath, JSON.stringify(brands, null, 2));
console.log(`Generated ${brands.length} brands to ${outputPath}`);
console.log(`Brands with images: ${brands.filter(b => b.coverImage).length}`);
