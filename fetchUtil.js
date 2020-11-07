exports.fetchCompanyDetail = async ({ cookie, userAgent, teamName }) => {
  try {
    const res = await fetch(`https://www.owler.com/company/${teamName}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'accept-encoding': 'gzip, deflate, br',
        'user-agent': userAgent,

        accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        cookie: `OWLER_PC=${cookie}`,
      },
    });
    if (res.status < 200 || res.status >= 300) return { status: res.status };
    return res.text();
  } catch (error) {
    console.log('error  ', error);
    throw error;
  }
};
