const axios = require('axios');
const path = require('path');
const fs = require('fs');
require('dotenv').config(); // Load environment variables

const savepath = './gists';
const url = `https://api.github.com/users/${process.env.GITHUB_USERNAME}/gists`;

// Function to sanitize and truncate file/directory names
const sanitize = (name, maxLength = 100) => {
  let sanitized = name
    .replace(/\s+/g, ' ')             // Replace multiple spaces/newlines with a single space
    .replace(/[<>:"\/\\|?*]+/g, '_')  // Replace invalid file system characters with underscores
    .replace(/[!•]+/g, '')            // Remove exclamation marks and bullet points
    .replace(/[-_]+/g, '_')           // Normalize hyphens and underscores into single underscores
    .trim();                          // Remove leading/trailing whitespace

  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength) + '_truncated'; // Truncate filename if too long
  }

  return sanitized;
};

// Authenticate API request with your GitHub token
const headers = {
  'User-Agent': 'request', // GitHub requires a User-Agent header
  'Authorization': `token ${process.env.GITHUB_TOKEN}`, // Token from .env file
};

const getAllGists = async (page = 1, allGists = []) => {
  try {
    const response = await axios.get(url, {
      headers,
      params: {
        page,   // GitHub paginates results; we'll loop through pages
        per_page: 100, // Get up to 100 gists per page
      },
    });

    const gists = response.data;
    if (gists.length > 0) {
      allGists = [...allGists, ...gists];
      // Recursively fetch the next page if there are more gists
      return getAllGists(page + 1, allGists);
    } else {
      return allGists; // Return all collected gists
    }
  } catch (error) {
    console.error(`Error fetching gists: ${error}`);
    return allGists;
  }
};

const downloadGists = async () => {
  const gists = await getAllGists();

  gists.forEach(gist => {
    const description = sanitize(gist.description || gist.id); // Sanitize description or use gist ID
    const dir = path.join(savepath, description);

    fs.mkdir(dir, { recursive: true }, (err) => {
      if (err) {
        console.error(`Error creating directory: ${err}`);
        return;
      }

      Object.keys(gist.files).forEach(file => {
        const raw_url = gist.files[file].raw_url;
        const filename = sanitize(gist.files[file].filename); // Sanitize filenames
        const filepath = path.join(dir, filename);

        console.log("downloading... " + filename);
        axios({
          method: 'get',
          url: raw_url,
          responseType: 'stream',
        }).then(fileResponse => {
          fileResponse.data.pipe(fs.createWriteStream(filepath));
        }).catch(error => {
          console.error(`Error downloading file ${filename}: ${error}`);
        });
      });
    });
  });

  console.log(`Downloaded ${gists.length} gists.`);
};

downloadGists();
