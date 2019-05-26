import { Helper } from '../helper.po';
import { PageHelper } from '../page-helper.po';
import { CrushMapPage } from './crush-map.po';

describe('CRUSH map page', () => {
  let page: CrushMapPage;

  beforeAll(() => {
    page = new CrushMapPage();
  });

  afterEach(() => {
    Helper.checkConsole();
  });

  describe('breadcrumb test', () => {
    beforeAll(() => {
      page.navigateTo();
    });

    it('should open and show breadcrumb', () => {
      expect(PageHelper.getBreadcrumbText()).toEqual('CRUSH map');
    });
  });
});
