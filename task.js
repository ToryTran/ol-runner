const axios = require('axios').default;
const puppeteer = require('puppeteer');
const loggers = require('./logUtil.js').init();
const _ = require('lodash');

const fetchCompanyDetail = require('./fetchUtil.js').fetchCompanyDetail;
const browserOption = {
  headless: false,
  devtools: false,
  ignoreHTTPSErrors: true,
  slowMo: 0,
  args: [
    '--disable-gpu',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
  ],
};
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:64.0) Gecko/`201`00101 Firefox/64.0',
  'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.110 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0.2 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.140 Safari/537.36 Edge/17.17134',
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:64.0) Gecko/20100101 Firefox/64.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36',
  'Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:64.0) Gecko/20100101 Firefox/64.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.14; rv:64.0) Gecko/20100101 Firefox/64.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.0 Safari/537.36',
];

let runProccessMangement = new Set();

async function getCompanyLink(start, end) {
  try {
    const res = await axios.get(
      `http://54.187.11.227:8000/query?start=${start}&end=${end}`
    );
    return res && res.data ? res.data : [];
  } catch (error) {
    console.error(error);
    return [];
  }
}

async function updateCompanyStatus(id, status = 404) {
  await axios.put(`http://54.187.11.227:8000/update-company-status`, {
    company_id: id,
    status,
  });
}

async function insertCompanyData(id, company) {
  try {
    const companyInfo = {
      id: company.companyId,
      name: company.companyName,
      shortName: company.shortName,
      city: company.city,
      state: company.state,
      country: company.country,
      zipcode: company.zipcode,
      website: company.website,
      ownership: company.ownership,
      totalFunding: company.totalFunding,
      teamName: company.teamName,
      totalRevenue: company.revenue,
      totalEmployees: company.employeeCount,
      ceoName: company.ceoDetail,
      address: {
        phone: company.phoneNumber,
        street1: company.street1Address,
        street2: '',
      },
      logo: company.logo,
      description: company.description || company.summarySection,
      founded: company.founded,
    };
    await axios.post(`http://54.187.11.227:8000/insert-company`, companyInfo);
    if (id != company.companyId) {
      await updateCompanyStatus(id, 404);
    }
  } catch (error) {
    loggers.log.error({
      fn: 'insertCompanyData',
      error: error.toString(),
    });
    throw error;
  }
}

async function doJob(auth, data, id = Date.now()) {
  runProccessMangement.add(id);
  let browser = null;
  let page = null;
  let pcCookie = '';
  try {
    browser = await puppeteer.launch(browserOption);
    page = await browser.newPage();
    await page.goto('https://www.owler.com/login');
    await page.waitForSelector('#email');
    await page.type('#email', auth.email, {
      delay: 15,
    });
    await page.click('button.modal-button');
    await page.waitForSelector('#password');
    await page.type('#password', auth.password, {
      delay: 15,
    });
    await page.click('button.modal-button');
    await page.waitForTimeout(10000);
    const cookies = (await page.cookies()).filter(
      (it) => it.name.toUpperCase() === 'OWLER_PC'
    );
    if (!cookies.length) throw 'CAN NOT GET COOKIE';

    pcCookie = cookies[0].value;

    const userAgent =
      userAgents[Math.floor((Math.random() * 100) % userAgents.length)];

    for (let i = 0; i < data.length; i++) {
      const companyInfo = data[i];
      if (
        !companyInfo ||
        !companyInfo.team_name ||
        companyInfo.team_name === '-'
      )
        continue;

      await sleep(3000);
      const res = await page.evaluate(fetchCompanyDetail, {
        cookie: pcCookie,
        userAgent,
        teamName: companyInfo.team_name || '',
      });

      console.log(
        `[${id}]status: ${res.status ? res.status : '200'} `,
        companyInfo
      );
      if (res.status === 429) {
        throw '429 Error';
      }
      if (!res.status) {
        // console.log(res);
        const jsonData = JSON.parse(
          res
            .substring(
              res.search('{"props":{"pageProps":'),
              res.search('module={}')
            )
            .trim()
        );
        await insertCompanyData(
          companyInfo.company_id,
          _.get(jsonData, 'props.pageProps.initialState')
        );
      } else {
        loggers.log.log({
          status: res.status,
          companyInfo,
        });
        updateCompanyStatus(companyInfo.company_id, res.status);
      }
    }
  } catch (error) {
    console.log(error);
    loggers.log.error({
      error: error.toString(),
    });
  } finally {
    page && page.close();
    browser && browser.close();
    runProccessMangement.delete(id);
  }
}

(async () => {
  const startCId = Number(process.argv[2]);
  const endCId = Number(process.argv[3]);
  const emails = process.argv.slice(5, 100);

  do {
    if (!runProccessMangement.size) {
      const data = await getCompanyLink(startCId, endCId);
      console.log('DATA: ', data);

      const paging = Math.round(data.length / emails.length);
      emails.forEach((email, index) => {
        const auth = { email, password: process.argv[4] };
        doJob(auth, data.slice(index * paging, (index + 1) * paging));
      });
    }
    await sleep(!runProccessMangement.size ? 5000 : 1000 * 60 * 5);
  } while (true);
})();
