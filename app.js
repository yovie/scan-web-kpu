const request = require('request')
const async = require('async')

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
                console.log('\t\tNational status : ', National.validation)
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
                        console.log('\tProvince ' + Province[code].parentName + ' status : ', Province[code].validation, output)
                    }

                    /** compare with national */
                    if (output.computed[JOKOWI] !== National.originalData.table[code][JOKOWI]
                        || output.computed[PRABOWO] !== National.originalData.table[code][PRABOWO]) {
                        console.log('\t' + Province[code].parentName + ' invalid', output, National.originalData.table[code])
                    }
                    console.log('\t\tProvince ' + Province[code].parentName + ' status : ', Province[code].validation)
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
            callback(opts, JSON.parse(body));
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