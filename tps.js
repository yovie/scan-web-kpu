const request = require('request')
const async = require('async')
const fs = require("fs");
const sleep = require('sleep');

const baseUri = 'https://pemilu2019.kpu.go.id'
const uriCapres = baseUri + '/static/json/ppwp.json'
const uriProvince = baseUri + '/static/json/wilayah/0.json'
const uriStatProvince = baseUri + '/static/json/hhcw/ppwp.json'
const uriBaseArea = baseUri + '/static/json/wilayah/'
const uriBaseStat = baseUri + '/static/json/hhcw/ppwp/'

const basePath = './data/'

const JOKOWI = '21'
const PRABOWO = '22'

let Area = []

class Scanner {

    constructor() {
        this.start()
    }

    /** main */

    start() {
        console.time('scanning')
        console.log('scan start ...')
        const that = this
        async.waterfall([
            /** get area */
            (cb) => {
                if (fs.existsSync(basePath + 'area.json')) {
                    const are = fs.readFileSync(basePath + 'area.json')
                    Area = JSON.parse(are)
                    cb()
                } else {
                    /** get area from server */
                    async.waterfall([
                        (cbb) => {
                            that.doGet(uriProvince, {}, (opt, provinsi) => {
                                Area = Object.keys(provinsi).map(idProv => {
                                    provinsi[idProv]['id'] = idProv
                                    provinsi[idProv]['level'] = 'provinsi'
                                    return provinsi[idProv]
                                })
                                cbb()
                            })
                        },
                        (cbb) => {
                            async.forEachOf(Area, (prov, num, cbbb) => {
                                const vcode = prov.id === '-99' ? 'ln' : prov.id
                                that.doGet(uriBaseArea + vcode + '.json', { level: 'kabupaten', code: prov.id }, (opt, kabkot) => {
                                    prov['children'] = Object.keys(kabkot).map(idKab => {
                                        if (typeof kabkot[idKab] === 'string') {
                                            kabkot[idKab] = {
                                                id: idKab,
                                                nama: kabkot[idKab],
                                                level: 'kabupaten'
                                            }
                                        } else {
                                            kabkot[idKab]['id'] = idKab
                                            kabkot[idKab]['level'] = 'kabupaten'
                                        }
                                        return kabkot[idKab]
                                    })
                                    cbbb()
                                })
                            }, () => {
                                cbb()
                            })
                        },
                        (cbb) => {
                            async.forEachOf(Area, (prov, num, cbbb) => {
                                async.forEachOf(prov.children, (kab, nu, cbbbb) => {
                                    const numcode = Number(kab.id)
                                    const numcode0 = numcode + 2
                                    const numcode1 = numcode + 1
                                    let addpath = Number(prov.id) < 0 ? '/' + numcode0 + '/' + numcode1 : ''
                                    this.doGet(uriBaseArea + prov.id + addpath + '/' + kab.id + '.json', { level: 'kecamatan', code: kab.id, provcode: prov.id, addpath: addpath }, (opt, kecamatan) => {
                                        kab['children'] = Object.keys(kecamatan).map(idKec => {
                                            kecamatan[idKec]['id'] = idKec
                                            kecamatan[idKec]['level'] = 'kecamatan'
                                            return kecamatan[idKec]
                                        })
                                        cbbbb()
                                    })
                                }, () => {
                                    cbbb()
                                })
                            }, () => {
                                cbb()
                            })
                        },
                        (cbb) => {
                            async.forEachOf(Area, (prov, num, cbbb) => {
                                async.forEachOf(prov.children, (kab, nu, cbbbb) => {
                                    async.forEachOf(kab.children, (kec, n, cbbbbb) => {
                                        const numcode = Number(kec.id)
                                        const numcode0 = numcode + 2
                                        const numcode1 = numcode + 1
                                        let addpath = Number(prov.id) < 0 ? '/' + numcode0 + '/' + numcode1 : ''
                                        this.doGet(uriBaseArea + prov.id + addpath + '/' + kec.id + '.json', { level: 'desa', code: kec.id, provcode: prov.id, addpath: addpath }, (opt, desa) => {
                                            kec['children'] = Object.keys(desa).map(idDes => {
                                                desa[idDes]['id'] = idDes
                                                desa[idDes]['level'] = 'desa'
                                                return desa[idDes]
                                            })
                                            cbbbbb()
                                        })
                                    }, () => {
                                        cbbbb()
                                    })
                                }, () => {
                                    cbbb()
                                })
                            }, () => {
                                cbb()
                            })
                        },
                        (cbb) => {
                            async.forEachOf(Area, (prov, num, cbbb) => {
                                async.forEachOf(prov.children, (kab, nu, cbbbb) => {
                                    async.forEachOf(kab.children, (kec, n, cbbbbb) => {
                                        async.forEachOf(kec.children, (desa, j, cbbbbbb) => {
                                            const numcode = Number(desa.id)
                                            const numcode0 = numcode + 2
                                            const numcode1 = numcode + 1
                                            let addpath = Number(prov.id) < 0 ? '/' + numcode0 + '/' + numcode1 : ''
                                            this.doGet(uriBaseArea + prov.id + addpath + '/' + desa.id + '.json', { level: 'tps', code: desa.id, provcode: prov.id, addpath: addpath }, (opt, tps) => {
                                                desa['children'] = Object.keys(tps).map(idTps => {
                                                    tps[idTps]['id'] = idTps
                                                    tps[idTps]['level'] = 'tps'
                                                    return tps[idTps]
                                                })
                                                cbbbbbb()
                                            })
                                        }, () => {
                                            cbbbbb()
                                        })
                                    }, () => {
                                        cbbbb()
                                    })
                                }, () => {
                                    cbbb()
                                })
                            }, () => {
                                cbb()
                            })
                        }
                    ], (result) => {
                        const farea = basePath + 'area.json'
                        // console.log(Area)
                        fs.writefileSync(farea, JSON.stringify(Area))
                        cb()
                    })
                }
            },

            (cb) => {
                /** get data tps */
                cb()
            }
        ], (result) => {
            console.timeEnd('scanning')
        })
    }


    /** functions */

    doGet(u, opts, callback) {
        request.get(u, { "rejectUnauthorized": false }, (err, res, body) => {
            console.log('\t\t\tget ', u, opts.level)
            try {
                const _json = JSON.parse(body)
                callback(opts, _json);
            } catch (jsonErr) {
                console.log(jsonErr)
                console.log('waiting 120 seconds to retry')
                sleep.sleep(120)
                this.doGet(u, opts, callback)
            }
        })
    }
}

new Scanner()
