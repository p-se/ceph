import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RouterTestingModule } from '@angular/router/testing';

import { ToastModule } from 'ng2-toastr';
import { TabsModule } from 'ngx-bootstrap/tabs';
import { BehaviorSubject, of } from 'rxjs';

import {
  configureTestBed,
  i18nProviders,
  PermissionHelper
} from '../../../../testing/unit-test-helper';
import { NfsService } from '../../../shared/api/nfs.service';
import { TableActionsComponent } from '../../../shared/datatable/table-actions/table-actions.component';
import { ExecutingTask } from '../../../shared/models/executing-task';
import { SummaryService } from '../../../shared/services/summary.service';
import { TaskListService } from '../../../shared/services/task-list.service';
import { SharedModule } from '../../../shared/shared.module';
import { NfsDetailsComponent } from '../nfs-details/nfs-details.component';
import { NfsListComponent } from './nfs-list.component';

describe('NfsListComponent', () => {
  let component: NfsListComponent;
  let fixture: ComponentFixture<NfsListComponent>;
  let summaryService: SummaryService;
  let nfsService: NfsService;
  let httpTesting: HttpTestingController;

  const refresh = (data) => {
    summaryService['summaryDataSource'].next(data);
  };

  configureTestBed(
    {
      declarations: [NfsListComponent, NfsDetailsComponent],
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        SharedModule,
        ToastModule.forRoot(),
        TabsModule.forRoot()
      ],
      providers: [TaskListService, i18nProviders]
    },
    true
  );

  beforeEach(() => {
    fixture = TestBed.createComponent(NfsListComponent);
    component = fixture.componentInstance;
    summaryService = TestBed.get(SummaryService);
    nfsService = TestBed.get(NfsService);
    httpTesting = TestBed.get(HttpTestingController);

    // this is needed because summaryService isn't being reset after each test.
    summaryService['summaryDataSource'] = new BehaviorSubject(null);
    summaryService['summaryData$'] = summaryService['summaryDataSource'].asObservable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('after ngOnInit', () => {
    beforeEach(() => {
      fixture.detectChanges();
      spyOn(nfsService, 'list').and.callThrough();
      httpTesting.expectOne('api/nfs-ganesha/daemon').flush([]);
      httpTesting.expectOne('api/summary');
    });

    afterEach(() => {
      httpTesting.verify();
    });

    it('should load exports on init', () => {
      refresh({});
      httpTesting.expectOne('api/nfs-ganesha/export');
      expect(nfsService.list).toHaveBeenCalled();
    });

    it('should not load images on init because no data', () => {
      refresh(undefined);
      expect(nfsService.list).not.toHaveBeenCalled();
    });

    it('should call error function on init when summary service fails', () => {
      spyOn(component.table, 'reset');
      summaryService['summaryDataSource'].error(undefined);
      expect(component.table.reset).toHaveBeenCalled();
    });
  });

  describe('handling of executing tasks', () => {
    let exports: any[];

    const addExport = (export_id) => {
      const model = {
        export_id: export_id,
        path: 'path_' + export_id,
        fsal: 'fsal_' + export_id,
        cluster_id: 'cluster_' + export_id
      };
      exports.push(model);
    };

    const addTask = (name: string, export_id: string) => {
      const task = new ExecutingTask();
      task.name = name;
      switch (task.name) {
        case 'nfs/create':
          task.metadata = {
            path: 'path_' + export_id,
            fsal: 'fsal_' + export_id,
            cluster_id: 'cluster_' + export_id
          };
          break;
        default:
          task.metadata = {
            cluster_id: 'cluster_' + export_id,
            export_id: export_id
          };
          break;
      }
      summaryService.addRunningTask(task);
    };

    const expectExportTasks = (expo: any, executing: string) => {
      expect(expo.cdExecuting).toEqual(executing);
    };

    beforeEach(() => {
      exports = [];
      addExport('a');
      addExport('b');
      addExport('c');
      component.exports = exports;
      refresh({ executing_tasks: [], finished_tasks: [] });
      spyOn(nfsService, 'list').and.callFake(() => of(exports));
      fixture.detectChanges();

      const req = httpTesting.expectOne('api/nfs-ganesha/daemon');
      req.flush([]);
    });

    it('should gets all exports without tasks', () => {
      expect(component.exports.length).toBe(3);
      expect(component.exports.every((expo) => !expo.cdExecuting)).toBeTruthy();
    });

    it('should add a new export from a task', fakeAsync(() => {
      addTask('nfs/create', 'd');
      tick();
      expect(component.exports.length).toBe(4);
      expectExportTasks(component.exports[0], undefined);
      expectExportTasks(component.exports[1], undefined);
      expectExportTasks(component.exports[2], undefined);
      expectExportTasks(component.exports[3], 'Creating');
    }));

    it('should show when an existing export is being modified', () => {
      addTask('nfs/edit', 'a');
      addTask('nfs/delete', 'b');
      expect(component.exports.length).toBe(3);
      expectExportTasks(component.exports[0], 'Updating');
      expectExportTasks(component.exports[1], 'Deleting');
    });
  });

  describe('show action buttons and drop down actions depending on permissions', () => {
    let tableActions: TableActionsComponent;
    let fn, empty, single;
    let permissionHelper: PermissionHelper;

    const getTableActionComponent = (): TableActionsComponent => {
      fixture.detectChanges();
      return fixture.debugElement.query(By.directive(TableActionsComponent)).componentInstance;
    };

    beforeEach(() => {
      permissionHelper = new PermissionHelper(component.permission, () =>
        getTableActionComponent()
      );
      fn = () => tableActions.getCurrentButton().name;
      single = 'Edit';
      empty = 'Add';
    });

    describe('with all', () => {
      beforeEach(() => {
        tableActions = permissionHelper.setPermissionsAndGetActions(true, true, true);
      });

      it(`shows 'Edit' for single selection else 'Add' as main action`, () =>
        permissionHelper.testScenarios(fn, empty, single));

      it('shows all actions', () => {
        expect(tableActions.tableActions.length).toBe(3);
        expect(tableActions.tableActions).toEqual(component.tableActions);
      });
    });

    describe('with read, create and update', () => {
      beforeEach(() => {
        tableActions = permissionHelper.setPermissionsAndGetActions(true, true, false);
      });

      it(`shows 'Edit' for single selection else 'Add' as main action`, () =>
        permissionHelper.testScenarios(fn, empty, single));

      it(`shows all actions except for 'Delete'`, () => {
        expect(tableActions.tableActions.length).toBe(2);
        component.tableActions.pop();
        expect(tableActions.tableActions).toEqual(component.tableActions);
      });
    });

    describe('with read, create and delete', () => {
      beforeEach(() => {
        tableActions = permissionHelper.setPermissionsAndGetActions(true, false, true);
      });

      it(`shows 'Delete' for single selection else 'Add' as main action`, () => {
        single = 'Delete';
        permissionHelper.testScenarios(fn, empty, single);
      });

      it(`shows 'Add', and 'Delete'  action`, () => {
        expect(tableActions.tableActions.length).toBe(2);
        expect(tableActions.tableActions).toEqual([
          component.tableActions[0],
          component.tableActions[2]
        ]);
      });
    });

    describe('with read, edit and delete', () => {
      beforeEach(() => {
        tableActions = permissionHelper.setPermissionsAndGetActions(false, true, true);
      });

      it(`shows always 'Edit' as main action`, () => {
        empty = 'Edit';
        permissionHelper.testScenarios(fn, empty, single);
      });

      it(`shows 'Edit' and 'Delete' actions`, () => {
        expect(tableActions.tableActions.length).toBe(2);
        expect(tableActions.tableActions).toEqual([
          component.tableActions[1],
          component.tableActions[2]
        ]);
      });
    });

    describe('with read and create', () => {
      beforeEach(() => {
        tableActions = permissionHelper.setPermissionsAndGetActions(true, false, false);
      });

      it(`always shows 'Add' as main action`, () => {
        single = 'Add';
        permissionHelper.testScenarios(fn, empty, single);
      });

      it(`shows 'Add' action`, () => {
        expect(tableActions.tableActions.length).toBe(1);
        expect(tableActions.tableActions).toEqual([component.tableActions[0]]);
      });
    });

    describe('with read and edit', () => {
      beforeEach(() => {
        tableActions = permissionHelper.setPermissionsAndGetActions(false, true, false);
      });

      it(`shows always 'Edit' as main action`, () => {
        empty = 'Edit';
        permissionHelper.testScenarios(fn, empty, single);
      });

      it(`shows 'Edit' action`, () => {
        expect(tableActions.tableActions.length).toBe(1);
        expect(tableActions.tableActions).toEqual([component.tableActions[1]]);
      });
    });

    describe('with read and delete', () => {
      beforeEach(() => {
        tableActions = permissionHelper.setPermissionsAndGetActions(false, false, true);
      });

      it(`shows always 'Delete' as main action`, () => {
        single = 'Delete';
        empty = 'Delete';
        permissionHelper.testScenarios(fn, empty, single);
      });

      it(`shows 'Delete' action`, () => {
        expect(tableActions.tableActions.length).toBe(1);
        expect(tableActions.tableActions).toEqual([component.tableActions[2]]);
      });
    });

    describe('with only read', () => {
      beforeEach(() => {
        tableActions = permissionHelper.setPermissionsAndGetActions(false, false, false);
      });

      it('shows no main action', () => {
        permissionHelper.testScenarios(() => tableActions.getCurrentButton(), undefined, undefined);
      });

      it('shows no actions', () => {
        expect(tableActions.tableActions.length).toBe(0);
        expect(tableActions.tableActions).toEqual([]);
      });
    });
  });
});
