
import { URL } from 'url';
import psl from 'psl';
import axios from 'axios';
import { parseStringPromise } from "xml2js";
import https from "https";
import pLimit from "p-limit";
import { digestMarkdown } from './setup.js';
export const sitemapGenerator = async (url) => {
  let baseUrl = "", sitemapUrls = []
  try {
    const urlObj = new URL(url);
    console.log("got url");
    const parsedDomain = psl.parse(urlObj.hostname);
    baseUrl = parsedDomain.domain || urlObj.hostname;

    // Attempt to fetch robots.txt
    sitemapUrls = [];
    try {
      const response = await axios.get(`https://${baseUrl}/robots.txt`);
      const match = response.data.match(/Sitemap:\s*(.+)/gi);
      if (match) {
        sitemapUrls = match.map(line => line.replace(/Sitemap:\s*/, '').trim());
      }
    } catch (err) {
      console.warn(`No robots.txt found for ${url}, trying default sitemap paths.`);
    }

    if (sitemapUrls.length === 0) {
      const commonPaths = [
        '/sitemap.xml', '/sitemap_index.xml', '/sitemap-index.xml', '/sitemap.php',
        '/sitemap.txt', '/sitemap.xml.gz', '/sitemap/', '/sitemap/sitemap.xml',
        '/sitemapindex.xml', '/sitemap/index.xml', '/sitemap1.xml'
      ];
      await Promise.all(commonPaths.map(async (path) => {
        try {
          const sitemapResponse = await axios.get(`https://${baseUrl}${path}`);
          if (sitemapResponse.status === 200) sitemapUrls.push(`https://${baseUrl}${path}`);
        } catch (error) {
          console.error(`error at ${path}`);
        }
      }))
    }
    if (sitemapUrls.length === 0) {
      console.error(`No sitemap found for ${url}`);
      return [];
    }
    return { sitemapUrls, mainUrl: `https://${baseUrl}/` };
  } catch (error) {
    console.error(`Error processing ${url}:`, error.message);
    return { sitemapUrls: [], mainUrl: `https://${baseUrl}/` };
  }
};
const userAgents = [
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)"
];
const agent = new https.Agent({ rejectUnauthorized: false });
export const fetchUrlsFromSitemap = async (sitemapUrls) => {
  const seenUrls = new Set();
  const allUrls = [];
  const fetchSitemap = async (url, attempt = 0) => {
    if (seenUrls.has(url)) return [];
    seenUrls.add(url);

    try {
      const response = await axios.get(url, {
        // headers: { "User-Agent": userAgents[attempt % userAgents.length] },
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Encoding": "gzip, deflate, br",
          "Accept-Language": "en-US,en;q=0.9",
          "Connection": "keep-alive",
        },
        httpsAgent: agent,
        timeout: 15000,
      });

      const xmlData = await parseStringPromise(response.data);
      const urls = [];

      if (xmlData.urlset && xmlData.urlset.url) {
        xmlData.urlset.url.forEach((entry) => {
          if (entry.loc) {
            urls.push({
              url: entry.loc[0],
              lastmod: entry.lastmod ? entry.lastmod[0] : null,
            });
          }
        });
      }

      if (xmlData.sitemapindex && xmlData.sitemapindex.sitemap) {
        const nestedSitemaps = xmlData.sitemapindex.sitemap.map((entry) => entry.loc[0]);
        return urls.concat(await Promise.all(nestedSitemaps.map(fetchSitemap)).then(res => res.flat()));
      }

      return urls;
    } catch (error) {
      console.error(`Error fetching ${url}: ${error.message}`);
      if (attempt < userAgents.length - 1) {
        console.log(`Retrying ${url} with a different User-Agent...`);
        return fetchSitemap(url, attempt + 1);
      }
      return [];
    }
  };

  const allFetchedUrls = sitemapUrls.length > 0 ? await Promise.all(sitemapUrls.map(fetchSitemap)) : []
  return allFetchedUrls.flat();
};
export const FetchUsingDroxy = async (url) => {
  try {
    let response = await fetch("https://api.droxy.ai/auth/login", {
      "headers": {
        "accept": "application/json, text/plain, */*",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache",
        "content-type": "application/json",
        "pragma": "no-cache",
        "priority": "u=1, i",
        "sec-ch-ua": "\"Not A(Brand\";v=\"8\", \"Chromium\";v=\"132\", \"Google Chrome\";v=\"132\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"macOS\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        "Referer": "https://app.droxy.ai/",
        "Referrer-Policy": "strict-origin-when-cross-origin"
      },
      "body": "{\"email\":\"gehawi7086@nike4s.com\",\"password\":\"Gehawi7086@nike4s\"}",
      "method": "POST"
    });
    const { accessToken } = await response.json();
    console.log("fetched access token");
    let encodedUrl = encodeURIComponent(url);
    response = await fetch(`https://api.droxy.ai/website/sub-links?url=${encodedUrl}`, {
      "headers": {
        "accept": "application/json, text/plain, */*",
        "accept-language": "en-US,en;q=0.9",
        "authorization": `Bearer ${accessToken}`,
        "cache-control": "no-cache",
        "pragma": "no-cache",
        "priority": "u=1, i",
        "sec-ch-ua": "\"Not A(Brand\";v=\"8\", \"Chromium\";v=\"132\", \"Google Chrome\";v=\"132\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"macOS\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        "Referer": "https://app.droxy.ai/",
        "Referrer-Policy": "strict-origin-when-cross-origin"
      },
      "body": null,
      "method": "GET"
    });
    const data = await response.json();
    return {
      urls: data.map(ele => {
        return {
          "url": ele
        }
      }),
      success: true
    }
  } catch (error) {
    console.error("error with api.droxy error:", error);
    return { success: false, error: error.message }
  }
}
export const processURLS = async (collectionId, urls) => {
  let finalResults = []
  try {
    const limit = pLimit(3); // Allows only 3 parallel requests at a time
    const batchSize = 3; // Sending 3 URLs per request
    const tasks = [];
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize).map(ele => ele.url); // Grouping URLs in batches of 3
      tasks.push(
        limit(async () => {
          try {
            const { data } = await axios.post("http://52.91.15.209:5000/crawl-urls", { urls: batch });
            if (data.results && data.results.length > 0) {
              return data.results.map(result => ({
                url: result.url,
                content: result.content,
                success: result.success,
                error: result.error
              }));
            } else {
              return batch.map(url => ({ url, error: "Invalid response format", success: false }));
            }
          } catch (error) {
            return batch.map(url => ({ url, error: error.message, success: false }));
          }
        })
      );
    }
    const results = await Promise.all(tasks);
    for (const ele of results.flat()) {
      if (ele.success) {
        await digestMarkdown(ele.content, ele.url, collectionId)
        finalResults.push({ success: true, url: ele.url })
      }
      else {
        finalResults.push({ success: false, url: ele.url, errors: ele.errors })
      }
    };
    return { success: true, data: finalResults }
  } catch (error) {
    console.error(error);
    return { success: false, error: error.message || error, data: finalResults }
  }
}
