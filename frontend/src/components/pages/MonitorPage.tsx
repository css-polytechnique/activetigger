import { FC, useEffect, useState } from 'react';
import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';
import DataGrid, { Column } from 'react-data-grid';
import Select from 'react-select';
import {
  useGetLogs,
  useGetServer,
  useGetUserStatistics,
  useStopProcess,
  useUsers,
} from '../../core/api';
import { PageLayout } from '../layout/PageLayout';

interface Computation {
  unique_id: string;
  user: string;
  time: string;
  kind: string;
}

interface Row {
  time: string;
  user: string;
  action: string;
}

export const MonitorPage: FC = () => {
  const { activeProjects, gpu, cpu, memory, disk, reFetchQueueState } = useGetServer(null);
  const { stopProcess } = useStopProcess();
  const { logs } = useGetLogs('all', 500);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const { userStatistics, reFetchStatistics } = useGetUserStatistics(currentUser);
  useEffect(() => {
    reFetchStatistics();
  }, [currentUser, reFetchStatistics]);
  const { users } = useUsers();
  const userOptions = users
    ? Object.keys(users).map((userKey) => ({
        value: userKey,
        label: userKey,
      }))
    : [];

  const columns: readonly Column<Row>[] = [
    {
      name: 'Time',
      key: 'time',
      resizable: true,
    },
    {
      name: 'User',
      key: 'user',
      resizable: true,
    },
    {
      name: 'Project',
      key: 'project',
    },
    {
      name: 'Action',
      key: 'action',
    },
  ];

  console.log(userStatistics);

  return (
    <PageLayout currentPage="monitor">
      <div className="container-fluid">
        <div className="row">
          <div className="col-12">
            <Tabs id="panel2" className="mb-3" defaultActiveKey="logs">
              <Tab eventKey="logs" title="Logs">
                <h2 className="subtitle">Recent activity on all projects</h2>
                {logs ? (
                  <DataGrid<Row>
                    className="fill-grid mt-2"
                    columns={columns}
                    rows={(logs as unknown as Row[]) || []}
                  />
                ) : (
                  <div>No rights</div>
                )}
              </Tab>
              <Tab eventKey="ressources" title="Ressouces">
                <h2 className="subtitle">Monitor ressources</h2>
                <table className="table-statistics">
                  <thead>
                    <tr>
                      <th colSpan={2} className="table-primary text-primary text-center">
                        Type
                      </th>
                      <th className="table-primary text-primary text-center">Ressources</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan={2}>GPU</td>
                      <td>{JSON.stringify(gpu)}</td>
                    </tr>
                    <tr>
                      <td colSpan={2}>CPU</td>
                      <td>{JSON.stringify(cpu)}</td>
                    </tr>
                    <tr>
                      <td colSpan={2}>Memory</td>
                      <td>{JSON.stringify(memory)}</td>
                    </tr>
                    <tr>
                      <td colSpan={2}>Disk</td>
                      <td>{JSON.stringify(disk)}</td>
                    </tr>
                  </tbody>
                </table>
                <hr />
              </Tab>
              <Tab eventKey="active" title="Active Projects">
                <h2 className="subtitle">Monitor the active project processes</h2>

                {Object.keys(activeProjects || {}).map((project) => (
                  <div key={project}>
                    <div>
                      <table className="table-statistics">
                        <thead>
                          <tr>
                            <th>Project</th>
                            <th colSpan={3} className="table-primary text-primary text-center">
                              {project}
                            </th>
                          </tr>
                          <tr>
                            <th>User</th>
                            <th>Time</th>
                            <th>Kind</th>
                            <th>Kill process</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeProjects &&
                            Object.values(activeProjects[project] as unknown as Computation[]).map(
                              (e) => (
                                <tr key={e.unique_id}>
                                  <td>{e.user}</td>
                                  <td>{e.time}</td>
                                  <td>{e.kind}</td>
                                  <td>
                                    <button
                                      onClick={() => {
                                        stopProcess(e.unique_id);
                                        reFetchQueueState();
                                      }}
                                      className="btn btn-danger"
                                    >
                                      kill
                                    </button>
                                  </td>
                                </tr>
                              ),
                            )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </Tab>
              <Tab eventKey="users" title="Users">
                <Select
                  id="select-user"
                  className="form-select"
                  options={userOptions}
                  onChange={(selectedOption) => {
                    setCurrentUser(selectedOption ? selectedOption.value : null);
                  }}
                  isClearable
                  placeholder="Select a user"
                />
                <table className="table-statistics">
                  <thead>
                    <tr>
                      <th colSpan={2} className="table-primary text-primary text-center">
                        User
                      </th>
                      <th className="table-primary text-primary text-center">Statistics</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userStatistics &&
                      Object.entries(userStatistics).map(([key, value]) => (
                        <tr key={key}>
                          <td colSpan={2}>{key}</td>
                          <td>{JSON.stringify(value)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </Tab>
            </Tabs>
          </div>
        </div>
      </div>{' '}
    </PageLayout>
  );
};
