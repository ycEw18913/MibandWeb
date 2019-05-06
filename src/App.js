import React, {Component} from 'react';
import MiBand from 'miband';
import {Table, Collapse, Button, Switch, Slider, InputNumber, Row, Col,} from 'antd';
import $ from 'jquery';
import 'antd/dist/antd.css';
import './App.css';

const Panel = Collapse.Panel;

function log() {
    const msg = [...arguments].join(' ');
    console.log(msg);
    $('.connect-log').append(`<p>${msg}</p>`)
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

class NotSupport extends Component {
    render() {
        return (
            <div>
                <h1>Your Browser Don't Support WebBluetooth</h1>
                <h2>You can get information at
                    https://github.com/WebBluetoothCG/web-bluetooth/blob/master/implementation-status.md</h2>
            </div>
        )
    }
}

class Info extends Component {
    render() {
        const columns = [{
            title: '名称',
            dataIndex: 'key',
            key: 'key',
        }, {
            title: '值',
            dataIndex: 'value',
            key: 'value',
        }];
        return (
            <Table
                dataSource={this.props.dataSource}
                loading={this.props.isLoading}
                columns={columns}
                pagination={false}
            />
        )
    }
}

class App extends Component {

    constructor(props) {
        super(props);
        this.state = {
            loading: false,
            support: false,
            connected: false,
            connecting: false,
            info: [],
            miband: false,
            bluetooth: false,
            hrm: false,
            rate: 0,
            shake: false,
            defer: 0,
        };
    }

    componentDidMount() {
        const bluetooth = navigator.bluetooth;
        if (!bluetooth) {
            log('WebBluetooth is not supported by your browser!');
            return;
        }
        this.setState({bluetooth: bluetooth, support: true});
    }

    render() {
        const _this = this;

        async function connect() {
            log('Start connect');

            _this.setState({connecting: true});

            try {
                log('Requesting Bluetooth Device...');
                const device = await _this.state.bluetooth.requestDevice({
                    filters: [
                        {services: [MiBand.advertisementService]}
                    ],
                    optionalServices: MiBand.optionalServices
                });

                device.addEventListener('gattserverdisconnected', () => {
                    log('Device disconnected');
                    notice_close();
                    _this.setState({connecting: false, connected: false});
                });
                await device.gatt.disconnect();
                log('Connecting to the device...');

                const server = await device.gatt.connect();
                log('Connected');

                log('Connecting to your Miband...');
                let miband = new MiBand(server);
                await miband.init();
                log('Finished. Please wait.');

                _this.setState({connected: true});

                await miband.showNotification('message');

                let info = {
                    time: await miband.getTime(),
                    battery: await miband.getBatteryInfo(),
                    hw_ver: await miband.getHwRevision(),
                    sw_ver: await miband.getSwRevision(),
                    serial: await miband.getSerial(),
                };

                let ped = await miband.getPedometerStats();

                _this.setState({
                    info: [
                        {key: '时间', value: info.time.toLocaleString()},
                        {key: '电量', value: info.battery.level + '%'},
                        {key: '步数', value: ped.steps},
                        {key: '里程', value: ped.distance + 'm'},
                        {key: '消耗', value: ped.calories + 'cal'},
                        {key: '硬件', value: info.hw_ver},
                        {key: '软件', value: info.sw_ver},
                    ]
                });

                _this.setState({miband: miband});

                miband.on('heart_rate', (rate) => {
                    _this.setState({rate: rate});
                    log('Heart Rate:', rate)
                });

                delay(0);
            } catch (error) {
                log('ERROR: ', error);
            }

            _this.setState({connecting: false})
        }

        async function test_all() {
            log('ACTION: test all');
            let miband = _this.state.miband;

            let info = {
                time: await miband.getTime(),
                battery: await miband.getBatteryInfo(),
                hw_ver: await miband.getHwRevision(),
                sw_ver: await miband.getSwRevision(),
                serial: await miband.getSerial(),
            };

            log(`HW ver: ${info.hw_ver}  SW ver: ${info.sw_ver}`);
            info.serial && log(`Serial: ${info.serial}`);
            log(`Battery: ${info.battery.level}%`);
            log(`Time: ${info.time.toLocaleString()}`);

            let ped = await miband.getPedometerStats();
            log('Pedometer:', JSON.stringify(ped));

            log('Notifications demo...');
            await miband.showNotification('message');
            await delay(3000);
            await miband.showNotification('phone');
            await delay(5000);
            await miband.showNotification('off');

            log('Tap MiBand button, quick!');
            miband.on('button', () => log('Tap detected'));
            try {
                await miband.waitButton(10000)
            } catch (e) {
                log('OK, nevermind ;)')
            }

            log('Heart Rate Monitor (single-shot)');
            log('Result:', await miband.hrmRead());

            log('Heart Rate Monitor (continuous for 30 sec)...');
            miband.on('heart_rate', (rate) => {
                log('Heart Rate:', rate)
            });
            await miband.hrmStart();
            await delay(30000);
            await miband.hrmStop();

            //log('RAW data (no decoding)...')
            //miband.rawStart();
            //await delay(30000);
            //miband.rawStop();

            log('Finished.')
        }

        async function notice_phone() {
            await notice_close();
            log('ACTION: phone notice');
            await _this.state.miband.showNotification('phone');
        }

        async function notice_message() {
            await notice_close();
            log('ACTION: message notice');
            await _this.state.miband.showNotification('message');
        }

        async function notice_vibrate() {
            await notice_close();
            log('ACTION: vibrate notice');
            await _this.state.miband.showNotification('vibrate');
        }

        async function notice_close() {
            log('ACTION: close notice');
            _this.setState({shake: false});
            await _this.state.miband.showNotification('off');
        }

        async function notice_unlimited() {
            await notice_close();
            log('ACTION: unlimited notice');
            _this.setState({shake: true}, async function () {
                while (_this.state.shake) {
                    await _this.state.miband.showNotification('vibrate');
                    await delay(1000);
                }
            });
        }

        async function hrm_start() {
            log('ACTION: start heart rate monitor');
            await _this.state.miband.hrmStart();
        }

        async function hrm_stop() {
            log('ACTION: stop heart rate monitor');
            await _this.state.miband.hrmStop();
        }

        async function hrm_switch() {
            _this.setState({hrm: !_this.state.hrm});
            _this.state.hrm ? hrm_stop() : hrm_start();
        }

        async function shake_mode() {
            await notice_close();
            log('ACTION: start shake mode');
            _this.setState({shake: true}, async function f() {
                while (_this.state.shake) {
                    await _this.state.miband.showNotification('vibrate');
                    await delay(_this.state.defer * 1000 + 500);
                }
            });
        }

        function change_defer(value) {
            log('ACTION: set defer ', value);
            _this.setState({defer: value});
        }

        if (this.state.support) {
            if (!this.state.connected) {
                return (
                    <div className="container">
                        <h1>MibandWeb</h1>
                        <h2>点击CONNECT连接到手环</h2>
                        <div className="connect-line">
                            <div className="connect-btn" onClick={connect}>
                                {this.state.connecting ? 'WAIT' : 'CONNECT'}
                            </div>
                        </div>
                        <div className="connect-log">
                            <h3>connect log</h3>
                        </div>
                    </div>
                )
            } else {
                return (
                    <div>
                        <h1>MibandWeb</h1>
                        <h2>{this.state.connected ? 'CONNECTED' : 'CONNECTING'}</h2>
                        <Collapse defaultActiveKey={['1']}>
                            <Panel header="INFO" key="1">
                                <Info dataSource={this.state.info} isLoading={!this.state.connected}/>
                            </Panel>
                            <Panel header="LOG" key="4">
                                <div className="connect-log" id="log">
                                    <h3>connect log</h3>
                                </div>
                            </Panel>
                            <Panel header="ACTION" key="2">
                                <Button block onClick={notice_phone}>电话通知</Button><br/>
                                <Button block onClick={notice_message}>短信通知</Button><br/>
                                <Button block onClick={notice_vibrate}>震动通知</Button><br/>
                                <Button block onClick={notice_unlimited}>无限震动</Button><br/>
                                <Button block onClick={notice_close} type="primary">关闭通知</Button><br/>
                                <Button block onClick={test_all} disabled>全部测试</Button><br/>
                            </Panel>
                            <Panel header="HRM" key="3">
                                <p>
                                    <span>心率检测开关&nbsp;&nbsp;</span>
                                    <Switch onChange={hrm_switch}/>
                                </p>
                                <p className="hrm-rate">
                                    <span>{this.state.rate}</span>
                                    <span className="hrm-unit">BPM</span>
                                </p>
                            </Panel>
                            <Panel header="SHAKE" key="5">
                                <h4>选择震动间隔</h4>
                                <Button block onClick={shake_mode}>开始</Button>
                                <Button block onClick={notice_close}>关闭</Button>
                                <Row>
                                    <Col span={12}>
                                        <Slider
                                            min={0}
                                            max={60}
                                            onChange={change_defer}
                                            value={typeof this.state.defer === 'number' ? this.state.defer : 0}
                                        />
                                    </Col>
                                    <Col span={4}>
                                        <InputNumber
                                            min={0}
                                            max={60}
                                            style={{marginLeft: 16}}
                                            value={this.state.defer}
                                            onChange={change_defer}
                                        />
                                    </Col>
                                </Row>
                            </Panel>
                        </Collapse>
                    </div>
                )
            }
        } else {
            return (
                <NotSupport/>
            )
        }
    }
}


export default App;
