const axios = require("axios").default;
const puppeteer = require("puppeteer");
const _ = require("lodash");
require("dotenv").config();
const winston = require("winston");
require("winston-daily-rotate-file");

const loggers = winston.createLogger({
  level: "error",
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: "error_job_single_detail.log" }),
  ],
});

const fetchCompanyDetail = async ({ cookie, userAgent, teamName }) => {
  try {
    const res = await fetch(`https://www.owler.com/company/${teamName}`, {
      method: "GET",
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "accept-encoding": "gzip, deflate, br",
        "user-agent": userAgent,

        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
        cookie: `OWLER_PC=${cookie}`,
      },
    });
    if (res.status < 200 || res.status >= 300) return { status: res.status };
    return res.text();
  } catch (error) {
    console.log("error  ", error);
    throw error;
  }
};

const browserOption = {
  headless: false,
  devtools: false,
  ignoreHTTPSErrors: true,
  slowMo: 0,
  args: [
    "--start-minimized",
    "--disable-gpu",
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
  ],
};
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:64.0) Gecko/`201`00101 Firefox/64.0",
  "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.110 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0.2 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.140 Safari/537.36 Edge/17.17134",
  "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:64.0) Gecko/20100101 Firefox/64.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36",
  "Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:64.0) Gecko/20100101 Firefox/64.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.14; rv:64.0) Gecko/20100101 Firefox/64.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.0 Safari/537.36",
];

let runProccessMangement = new Set();
let scrapedCompany = new Set();
let serverUrl = process.env.HOST;

async function getCompanyLink(start, end) {
  try {
    const res = await axios.get(`${serverUrl}/query?start=${start}&end=${end}`);
    return res && res.data ? res.data : [];
  } catch (error) {
    console.error(error);
    return [];
  }
}

async function updateCompanyStatus(id, status = 404) {
  await axios.put(`${serverUrl}/update-company-status`, {
    company_id: id,
    status,
  });
}

async function insertCompanyData(id, company) {
  try {
    const companyInfo = {
      id: Number(company.companyId),
      name: company.companyName,
      shortName: company.shortName,
      city: company.city,
      state: company.state,
      country: company.country,
      zipcode: Number(company.zipcode) || 0,
      website: company.website,
      ownership: company.ownership,
      totalFunding: Number(company.totalFunding || "0"),
      companyFundingInfo: JSON.stringify(company.companyFundingInfo),
      teamName: company.teamName,
      totalRevenue: Number(company.revenue || "0"),
      totalEmployees: Number(company.employeeCount || "0"),
      ceoName: JSON.stringify(company.ceoDetail) || "",
      address: JSON.stringify({
        phone: company.phoneNumber,
        street1: company.street1Address,
        street2: "",
      }),
      logo: company.logo,
      description: company.description || company.summarySection,
      founded: company.founded,
      status: 200,
    };
    await axios.post(`${serverUrl}/insert-company`, companyInfo);
    if (id != company.companyId) {
      console.log("id---", id, company.companyId);
      await updateCompanyStatus(id, 404);
    }
  } catch (error) {
    loggers.error({
      fn: "insertCompanyData",
      error: error.toString(),
    });
    throw error;
  }
}

async function doJob(auth, data, id = Date.now()) {
  runProccessMangement.add(id);
  let browser = null;
  let page = null;
  let pcCookie = "";
  try {
    browser = await puppeteer.launch(browserOption);
    page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36"
    );
    await page.goto("https://www.owler.com/login");
    await page.waitForSelector("#email");
    await page.type("#email", auth.email, {
      delay: 15,
    });
    await page.click("button.modal-button");
    await page.waitForSelector("#password");
    await page.type("#password", auth.password, {
      delay: 15,
    });
    await page.click("button.modal-button");
    await page.waitForTimeout(10000);
    const cookies = (await page.cookies()).filter(
      (it) => it.name.toUpperCase() === "OWLER_PC"
    );
    if (!cookies.length) throw "CAN NOT GET COOKIE";

    pcCookie = cookies[0].value;

    for (let i = 0; i < data.length; i++) {
      const companyInfo = data[i];

      if (scrapedCompany.has(companyInfo.id)) continue;

      scrapedCompany.add(companyInfo.id);
      if (
        !companyInfo ||
        !companyInfo.team_name ||
        companyInfo.team_name === "-"
      )
        continue;
      const userAgent =
        userAgents[Math.floor((Math.random() * 100) % userAgents.length)];
      await sleep(3000);
      const res = await page.evaluate(fetchCompanyDetail, {
        cookie: pcCookie,
        userAgent,
        teamName: companyInfo.team_name || "",
      });

      console.log(
        `[${auth.email}]status: ${res.status ? res.status : "200"} `,
        companyInfo
      );
      if (res.status === 429) {
        throw "429 Error";
      }
      if (!res.status) {
        // console.log(res);
        const jsonData = JSON.parse(
          res
            .substring(
              res.search('{"props":{"pageProps":'),
              res.search("module={}")
            )
            .trim()
        );
        await insertCompanyData(
          companyInfo.id,
          _.get(jsonData, "props.pageProps.initialState")
        );
      } else {
        loggers.error({
          status: res.status,
          companyInfo,
        });
        updateCompanyStatus(companyInfo.id, res.status);
      }
    }
  } catch (error) {
    console.log(error);
    loggers.error({
      error: error.toString(),
    });
  } finally {
    page && page.close();
    browser && browser.close();
    runProccessMangement.delete(id);
  }
}

(async () => {
  const startCId = Number(process.env.START);
  const endCId = Number(process.env.END);
  const emails = process.env.EMAILS.split(",");
  let data = [];
  do {
    if (!runProccessMangement.size) {
      if (scrapedCompany.size >= data.length) {
        data = await getCompanyLink(startCId, endCId);
        scrapedCompany.clear();
        console.log("Data: ", data);
      }
      if (data && data.length) {
        const paging = Math.round(data.length / emails.length);
        emails.forEach((email, index) => {
          const auth = { email, password: process.env.PASSWORD };
          doJob(auth, data.slice(index * paging, (index + 1) * paging));
        });
      }
    }
    await sleep(300000);
  } while (true);
})();
