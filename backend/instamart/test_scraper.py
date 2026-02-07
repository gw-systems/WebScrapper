"""Test runner for the scraper"""
import sys
sys.stdout = open('scraper_output.txt', 'w', encoding='utf-8')
sys.stderr = sys.stdout

from api_scraper import InstamartAPIScraper

scraper = InstamartAPIScraper()
scraper.scrape_all_categories()
