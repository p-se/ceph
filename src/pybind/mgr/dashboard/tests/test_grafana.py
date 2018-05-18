from unittest import TestCase

import cherrypy
import six
from .. import mgr
from ..controllers import BaseController, ApiController, no_browsable_api
from ..controllers.grafana import GrafanaProxy, GrafanaRestClient

from .helper import ControllerTestCase


class Grafana(TestCase):
    def test_missing_credentials(self):
        with six.assertRaisesRegex(self, LookupError,
                                   r'username and/or password'):
            GrafanaRestClient(
                url='http://localhost:3000', username='', password='admin')
        with six.assertRaisesRegex(self, LookupError, r'token'):
            GrafanaRestClient(
                url='http://localhost:3000',
                token='',
            )
        with six.assertRaisesRegex(self, LookupError, r'^No URL.*'):
            GrafanaRestClient(
                url='//localhost:3000', username='admin', password='admin')


@ApiController('grafana/mocked/{path:.*}')
class GrafanaMockInstance(BaseController):
    @no_browsable_api
    @cherrypy.expose()
    def __call__(self, path, **params):
        cherrypy.response.headers['foo'] = 'bar'
        return 'Static Content at path {}'.format(path)


class GrafanaControllerTestCase(ControllerTestCase):
    @classmethod
    def setup_server(cls):
        settings = {
            'GRAFANA_API_URL': 'http://localhost:{}/grafana/mocked/'.format(54583),
            'GRAFANA_API_USERNAME': 'admin',
            'GRAFANA_API_PASSWORD': 'admin',
            'GRAFANA_API_AUTH_METHOD': 'password',
        }
        mgr.get_config.side_effect = settings.get
        GrafanaProxy._cp_config['tools.authenticate.on'] = False  # pylint: disable=protected-access

        cls.setup_controllers([GrafanaProxy, GrafanaMockInstance])

    def test_grafana_proxy(self):
        self._get('/grafana/mocked/foo')
        self.assertStatus(200)
        self.assertBody('Static Content at path foo')

        # Test the proxy
        self._get('/grafana/proxy/bar')
        self.assertStatus(200)
        self.assertBody('Static Content at path bar')
