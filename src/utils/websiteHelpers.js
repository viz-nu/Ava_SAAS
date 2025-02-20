
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
          console.log(`error at ${path}`);
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
    console.log("error with api.droxy error:", error);
    return { success: false, error: error.message }
  }
}
export const processURLS = async (collectionId, urls) => {
  let finalResults = []
  try {
    const limit = pLimit(3); // Allows only 3 parallel requests at a time
    const batchSize = 3; // Sending 3 URLs per request
    const tasks = [];
    // const tasks = urls.map((url) =>
    //   limit(async () => {
    //     try {
    //       const { data } = await axios.post("http://52.91.15.209:5000/crawl-urls", { urls: [url] });
    //       if (data.results && data.results.length > 0) {
    //         return data.results.map(result => ({
    //           url: result.url,
    //           content: result.content,
    //           success: result.success,
    //           error: result.error
    //         }));
    //       } else {
    //         return [{ url, error: "Invalid response format", success: false }];
    //       }
    //     } catch (error) {
    //       return [{ url, error: error.message, success: false }];
    //     }
    //   })
    // );

    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize); // Grouping URLs in batches of 3
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
    // Wait for all tasks to complete
    const results = await Promise.all(tasks);
    // console.log("Processed URLs:", results.flat()); // Flatten for a clean output
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
    console.log(error);
    return { success: false, error: error.message || error, data: finalResults }
  }
}

// console.time()
// await processURLS("", [
//   "https://onewindow.co/luxury-brand-management/",
//   "https://onewindow.co/cgpa-to-gpa-conversion-table/",
//   "https://onewindow.co/hdfc-credila-education-loan-for-study-abroad/",
//   "https://onewindow.co/meaning-of-gpa-its-importance-while-seeking-admissions-in-the-usa/",
//   "https://onewindow.co/top-5-universities-of-canada-to-complete-your-masters-from/",
//   "https://onewindow.co/what-are-the-common-myths-of-studying-abroad-myths-busted/",
//   "https://onewindow.co/list-of-best-law-courses-in-canada-after-12th-for-indian-students-colleges-eligibility-ranking/",
//   "https://onewindow.co/is-studying-abroad-in-uk-worth-it-for-indian-students/",
//   "https://onewindow.co/cost-of-studying-abroad-in-australia-for-indian-students/",
//   "https://onewindow.co/9-cheapest-countries-for-indian-students-to-study-abroad-2022-list/",
//   "https://onewindow.co/can-you-study-dentistry-abroad-without-clearing-neet/",
//   "https://onewindow.co/study-abroad-scholarships-and-grants-to-apply-for-in-2022/",
//   "https://onewindow.co/study-abroad-silver-scholarships-2022/",
//   "https://onewindow.co/ielts-band-scores/",
//   "https://onewindow.co/how-to-overcome-homesickness/",
//   "https://onewindow.co/the-new-shorter-gre-general-test-discover-exciting-new-changes/",
//   "https://onewindow.co/how-to-deal-with-cultural-shock-2/",
//   "https://onewindow.co/6-things-to-do-after-your-visa-is-approved/",
//   "https://onewindow.co/accomodation/",
//   "https://onewindow.co/gre-and-gmat/",
//   "https://onewindow.co/is-study-gap-acceptable-in-canada/",
//   "https://onewindow.co/manage-your-finances-abroad/",
//   "https://onewindow.co/scholarships-for-jain-minority-students/",
//   "https://onewindow.co/tips-and-tricks-to-crack-exams-1/",
//   "https://onewindow.co/top-13-most-instagrammable-places-to-visit-in-london/",
//   "https://onewindow.co/top-mba-college/",
//   "https://onewindow.co/will-backlogs-affect-your-study-abroad-dream/",
//   "https://onewindow.co/2023-guide-to-apply-for-wsudigital-badge-program-latest-guide-2023/",
//   "https://onewindow.co/5-easy-steps-to-apply-for-admission-for-abroad-education/",
//   "https://onewindow.co/summer-programs-short-term-opportunities/",
//   "https://onewindow.co/07-tips-to-make-friends-while-you-study-abroad/",
//   "https://onewindow.co/is-study-gap-accepted-in-the-uk/",
//   "https://onewindow.co/scholarship-vs-student-loan-understanding-the-pros-and-cons/",
//   "https://onewindow.co/top-5-academic-success-strategies-for-study-abroad/",
//   "https://onewindow.co/steps-to-select-university/",
//   "https://onewindow.co/how-to-prepare-for-your-english-proficiency-test/",
//   "https://onewindow.co/france-as-a-study-abroad-destination/",
//   "https://onewindow.co/home-old/",
//   "https://onewindow.co/contact/",
//   "https://onewindow.co/countries/",
//   "https://onewindow.co/scholarship/",
//   "https://onewindow.co/major-and-degrees/",
//   "https://onewindow.co/services/",
//   "https://onewindow.co/test-prep/",
//   "https://onewindow.co/blog/",
//   "https://onewindow.co/career/",
//   "https://onewindow.co/review-your-statement-of-purpose/",
//   "https://onewindow.co/about-us/",
//   "https://onewindow.co/countries/study-abroad-usa/",
//   "https://onewindow.co/countries/study-abroad-australia/",
//   "https://onewindow.co/countries/study-abroad-united-kingdom/",
//   "https://onewindow.co/countries/study-abroad-ireland/",
//   "https://onewindow.co/countries/study-abroad-italy/",
//   "https://onewindow.co/countries/study-abroad-germany/",
//   "https://onewindow.co/countries/study-abroad-france/",
//   "https://onewindow.co/countries/study-abroad-canada/",
//   "https://onewindow.co/countries/study-abroad-netherland/",
//   "https://onewindow.co/financial-award-policy/",
//   "https://onewindow.co/ielts/",
//   "https://onewindow.co/resources/",
//   "https://onewindow.co/faqs/",
//   "https://onewindow.co/refund-policy/",
//   "https://onewindow.co/privacy-policy/",
//   "https://onewindow.co/terms-and-conditions/",
//   "https://onewindow.co/testing/",
//   "https://onewindow.co/events/",
//   "https://onewindow.co/events-2024/",
//   "https://onewindow.co/student-visa-webinar/",
//   "https://onewindow.co/",
//   "https://onewindow.co/sample/",
//   "https://onewindow.co/about-2024/",
//   "https://onewindow.co/alumni-connect/",
//   "https://onewindow.co/sample-2/",
//   "https://onewindow.co/bachelors-recruitment/",
//   "https://onewindow.co/two-plus-two-twinning-program/",
//   "https://onewindow.co/summerprogram/",
//   "https://onewindow.co/masters-recruitment123/",
//   "https://onewindow.co/masters-recruitment/",
//   "https://onewindow.co/student-recruitment/",
//   "https://onewindow.co/category/uncategorized/",
//   "https://onewindow.co/category/blog/"
// ])
// console.timeEnd();