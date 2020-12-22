# -*- coding: utf-8 -*-
import scrapy
import mysql.connector
from decouple import config

class CoinsSpider(scrapy.Spider):
    name = 'coins'
    # allowed_domains = ['coinmarketcap.com']
    source_domain = 'https://www.thesfmarathon.com'

    def getUrl(self):
        print("a112412451233423423423")
        mydb = mysql.connector.connect(
            host=config('DB_HOST'),
            user=config('DB_USER'),
            password=config('DB_PASSWORD'),
            database=config('DB_DATABASE'),
            )
        mycursor = mydb.cursor()
        mycursor.execute("SELECT team_name FROM " + config('DB_TABLE') + " limit 10")
        return mycursor.fetchall()

    def start_requests(self):
        urls = self.getUrl()
        # print('start_request ---', urls)
        # for url in urls:
        #     yield scrapy.Request(url=f'{start_urls[0]}/{url}', callback=self.parse)
        # urls = [
        #     'http://quotes.toscrape.com/page/1',
        #     'http://quotes.toscrape.com/page/2',
        # ]
        for url in urls:
            print('start_request ---', url[0])
            yield scrapy.Request(url=f'{self.source_domain}/{url[0]}', callback=self.parse)

    def parse(self, response):
        print('status 333: ', response.selector.xpath("/html[1]/body[1]/div[1]/div[1]/div[1]/div[1]/main[1]/div[1]/div[2]/div[1]/main[1]/div[1]/div[2]/div[1]/div[1]/p[1]").get())
        # pass

  