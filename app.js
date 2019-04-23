const request = require('request')
const async = require('async')
const sleep = require('sleep');

const baseUri = 'https://pemilu2019.kpu.go.id'
const uriCapres = baseUri + '/static/json/ppwp.json'
const uriProvince = baseUri + '/static/json/wilayah/0.json'
const uriStatProvince = baseUri + '/static/json/hhcw/ppwp.json'
const uriKabKot = baseUri + '/static/json/wilayah/'
const uriStatKabKot = baseUri + '/static/json/hhcw/ppwp/'

const Basic = {
    parent: '',
    parentName: '',
    list: [],
    originalData: {},
    validation: false
}

const JOKOWI = '21'
const PRABOWO = '22'

const Capres = {
    list: []
}

const National = Object.assign({}, Basic)
const Province = {}
const District = {}
const Subdistrict = {}
const Village = {}

const Summary = []

class Scanner {

    constructor() {
        this.start()
    }

    /** main */

    start() {
        console.time('scanning')
        console.log('scan start ...')

        async.waterfall([
            /** get capres */
            (cb) => {
                console.log('\tprocessing provinces ...')
                this.doGet(uriCapres, {}, (opt, capres) => {
                    Capres.list = capres
                    cb()
                })
            },
            /** get provinsi */
            (cb) => {
                this.doGet(uriProvince, {}, (opt, provinsi) => {
                    National.list = provinsi
                    cb()
                })
            },
            /** get stat provinsi */
            (cb) => {
                this.doGet(uriStatProvince, {}, (opt, statProv) => {
                    National.originalData = statProv
                    for (const code in National.list) {
                        National.list[code]['total'] = statProv.table[code]
                    }
                    cb()
                })
            },
            /** provinsi validation */
            (cb) => {
                this.validate(National)
                if (National.validation === false) {
                    Summary.push({
                        level: 'Nasional',
                        name: 'Indonesia',
                        status: National.validation,
                        message: 'Chart nasional tidak sesuai dengan angka di tabel'
                    })
                    console.log('\t\tNational status : ', National.validation)
                }
                cb()
            },

            /** get kabkot */
            (cb) => {
                console.log('\tprocessing cities ...')
                async.forEachOf(National.list, (item, code, cbb) => {
                    if (Province[code] === undefined) {
                        Province[code] = Object.assign({}, Basic)
                        Province[code].parent = code
                        Province[code].parentName = item.nama
                    }
                    const vcode = code === '-99' ? 'ln' : code
                    // sleep.sleep(3)
                    this.doGet(uriKabKot + vcode + '.json', { code: code }, (opt, kabkot) => {
                        Province[opt.code].list = kabkot
                        cbb()
                    })
                }, () => {
                    cb()
                })
            },
            /** get stat kabkot */
            (cb) => {
                async.forEachOf(Province, (item, code, cbb) => {
                    this.doGet(uriStatKabKot + code + '.json', { code: code }, (opt, statkabkot) => {
                        Province[code].originalData = statkabkot
                        for (const _code in Province[code].list) {
                            if (typeof Province[code].list[_code] === 'string') {
                                Province[code].list[_code] = {
                                    nama: Province[code].list[_code],
                                    total: statkabkot.table[_code]
                                }
                            } else {
                                Province[code].list[_code]['total'] = statkabkot.table[_code]
                            }
                        }
                        cbb()
                    })
                }, () => {
                    cb()
                })
            },
            /** kabkot validation */
            (cb) => {
                /** validate province */
                for (const code in Province) {
                    const output = this.validate(Province[code])
                    if (Province[code].validation === false) {
                        Summary.push({
                            level: 'Province',
                            name: Province[code].parentName,
                            status: Province[code].validation,
                            message: 'Chart provinsi tidak sesuai dengan angka di tabel'
                        })
                        console.log('\tProvince ' + Province[code].parentName + ' status : ', Province[code].validation, output)
                    }

                    /** compare with national */
                    if (output.computed[JOKOWI] !== National.originalData.table[code][JOKOWI]
                        || output.computed[PRABOWO] !== National.originalData.table[code][PRABOWO]) {
                        console.log('\t' + Province[code].parentName + ' invalid, sum kabupaten ', output, ' data nasional ', National.originalData.table[code])
                        Province[code].validation = false
                        Summary.push({
                            level: 'Province',
                            name: Province[code].parentName,
                            status: Province[code].validation,
                            message: 'SUM data kabupaten tidak sesuai dengan data provinsi'
                        })
                    }

                }
                cb()
            },

            /** get kecamatan */
            (cb) => {
                console.log('\tprocessing sub-district ...')
                async.forEachOf(Province, (item, provcode, cbb) => {
                    async.forEachOf(Province[provcode].list, (_item, code, _cbb) => {
                        if (District[code] === undefined) {
                            District[code] = Object.assign({}, Basic)
                            District[code].parent = provcode
                            District[code].parentName = _item.nama
                        }
                        const numcode = Number(code)
                        const numcode0 = numcode + 2
                        const numcode1 = numcode + 1
                        let addpath = Number(provcode) < 0 ? '/' + numcode0 + '/' + numcode1 : ''
                        // sleep.sleep(3)
                        this.doGet(uriKabKot + provcode + addpath + '/' + code + '.json', { code: code, provcode: provcode, addpath: addpath }, (opt, subdistrict) => {
                            // console.log('subdistrict ', opt, subdistrict)
                            District[opt.code].list = subdistrict
                            _cbb()
                        })
                    }, () => {
                        cbb()
                    })
                }, () => {
                    cb()
                })
            },
            /** get stat kecamatan */
            (cb) => {
                async.forEachOf(District, (item, code, cbb) => {
                    const numcode = Number(code)
                    const numcode0 = numcode + 2
                    const numcode1 = numcode + 1
                    let addpath = Number(item.parent) < 0 ? '/' + numcode0 + '/' + numcode1 : ''
                    this.doGet(uriStatKabKot + item.parent + addpath + code + '.json', { code: code, provcode: item.parent, addpath: addpath }, (opt, statkecamatan) => {
                        // console.log('subdistrict stat ', opt, statkecamatan)
                        District[opt.code].originalData = statkecamatan
                        for (const _code in District[opt.code].list) {
                            if (typeof District[opt.code].list[_code] === 'string') {
                                District[opt.code].list[_code] = {
                                    nama: District[opt.code].list[_code],
                                    total: statkecamatan.table[_code]
                                }
                            } else {
                                District[opt.code].list[_code]['total'] = statkecamatan.table[_code]
                            }
                        }
                        cbb()
                    })
                }, () => {
                    cb()
                })
            },
            /** kecamatan validation */
            (cb) => {
                /** validate subdistrict */
                for (const code in District) {
                    const output = this.validate(District[code])
                    if (District[code].validation === false) {
                        console.log('\tDistrict ' + District[code].parentName + ' status : ', District[code].validation, output)
                        Summary.push({
                            level: 'District',
                            name: District[code].parentName,
                            status: District[code].validation,
                            message: 'Chart kabupaten/kota tidak sesuai dengan angka di tabel'
                        })
                    }

                    /** compare with province */
                    if (output.computed[JOKOWI] !== Province[District[code].parent].originalData.table[code][JOKOWI]
                        || output.computed[PRABOWO] !== Province[District[code].parent].originalData.table[code][PRABOWO]) {
                        console.log('\t' + Province[District[code].parent].parentName + ' invalid, sum kecamatan ', output)
                        District[code].validation = false
                        Summary.push({
                            level: 'District',
                            name: District[code].parentName,
                            status: District[code].validation,
                            message: 'SUM data kecamatan tidak sesuai dengan data kabupaten'
                        })
                    }

                }
                cb()
            },

        ], () => {
            console.log('done')
            console.timeEnd('scanning')
        })
    }



    /** functions */

    doGet(u, opts, callback) {
        request.get(u, { "rejectUnauthorized": false }, (err, res, body) => {
            // console.log('\t\t\tget ', u)
            try {
                const _json = JSON.parse(body)
                callback(opts, _json);
            } catch (jsonErr) {
                // console.log(body)
                this.doGet(u, opts, callback)
            }
        })
    }

    validate(data) {
        let totalJokowi = 0
        let totalPrabowo = 0
        for (const code in data.list) {
            totalJokowi += data.list[code].total ? Number(data.list[code].total[JOKOWI]) : 0
            totalPrabowo += data.list[code].total ? Number(data.list[code].total[PRABOWO]) : 0
        }
        if (totalJokowi === data.originalData.chart[JOKOWI]
            && totalPrabowo === data.originalData.chart[PRABOWO]) {
            data.validation = true
        } else {
            data.validation = false
        }

        const result = {
            original: {},
            computed: {}
        }
        result.original[JOKOWI] = data.originalData.chart[JOKOWI]
        result.original[PRABOWO] = data.originalData.chart[PRABOWO]
        result.computed[JOKOWI] = totalJokowi
        result.computed[PRABOWO] = totalPrabowo

        return result
    }
}

new Scanner()
