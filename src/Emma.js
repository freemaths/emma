import React, { Component } from 'react'
import { Map, TileLayer, CircleMarker } from 'react-leaflet'
import cpr from './cpr.csv.gz'
import SOCAT from './SOCAT.csv.gz'
import pako from 'pako'
const mnth = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function dd_mm_yyyy(str) {
  const m = str.match(/^(\d\d)\/(\d\d)\/(\d\d\d\d)( (\d\d):(\d\d))?$/)
  const d = m ? new Date(m[3], m[2] - 1, m[1], (m[4] && m[5]) || 0, (m[4] && m[6]) || 0, 0) : null
  if (!d || !d.getFullYear()) return null
  else return d
}

class Emma extends Component {
  state = {}
  data = {}
  componentDidMount() {
    [
      //["Sample_Id", "Latitude", "Longitude", "Midpoint_Date_Local", "Year", "Month", "195", "10508", "10509", "10510", "10511", "10512", "10513", "10514", "10515"]
      { data: cpr, name: 'cpr', cols: { x: 'Latitude', y: 'Longitude', date: 'Midpoint_Date_Local', ABUN: '195' }, date: dd_mm_yyyy, errors: 20 },
      //["DATE", "LAT", "LON", " COUNT_NCRUISE", " FCO2_COUNT_NOBS", " FCO2_AVE_WEIGHTED", " FCO2_AVE_UNWTD", " FCO2_MIN_UNWTD", " FCO2_MAX_UNWTD", " SST_COUNT_NOBS", " SST_AVE_WEIGHTED", " SST_AVE_UNWTD", " SST_MIN_UNWTD", " SST_MAX_UNWTD", " SALINITY_COUNT_NOBS", " SALINITY_AVE_WEIGHTED", " SALINITY_AVE_UNWTD", " SALINITY_MIN_UNWTD", " SALINITY_MAX_UNWTD"
      { data: SOCAT, name: 'SOCAT', cols: { x: 'LAT', y: 'LON', date: 'DATE', CO2: 'FCO2_AVE_WEIGHTED', SSS: 'SALINITY_AVE_WEIGHTED', SST: 'SST_AVE_WEIGHTED' }, filter: { SSS: { min: 26, max: 40 }, CO2: { min: 200, max: 500 }, date: { min: 1993, max: 2019 }, x: { min: 30, max: 80 }, y: { min: -75, max: 26 } }, date: dd_mm_yyyy, errors: 500 }
    ].forEach(s => this.load_data(s)
      .then(d => {
        this.data[d.name] = d
        if (d.errors.length) console.log(d.name, 'errors', d.errors)
        console.log(d.name, { lines: d.lines, filtered: d.filter, d })
        if (d.name === 'SOCAT') this.setState({ socat: d })
        else this.setState({ cpr: d })
      }).catch(e => {
        console.error(e.name, 'too many errors', e.errors)
      }))
  }
  load_data(f) {
    return new Promise((resolve, reject) => {
      fetch(f.data)
        .then(function (response) {
          return response.arrayBuffer()
        })
        .then(csv => {
          let rows = pako.inflate(csv, { to: 'string' }).split(/\r\n|\n/).map(l => { return l.replace(/"([^,]*), ([^,]*)"/, "$2 $1").replace(/"/g, '').split(',') })
          const head = rows[0].map(r => { return r.trim() })
          const data = { name: f.name, l: {}, ps: {}, ys: {}, n: [], errors: [], lines: 0, filter: 0 }
          for (data.lines = 1; data.lines < rows.length && data.errors.length < f.errors; data.lines++) {
            const r = rows[data.lines]
            const d = {}, ks = Object.keys(f.cols)
            for (var i = 0; i < ks.length; i++) {
              const k = ks[i]
              if (!r[head.indexOf(f.cols[k])]) {
                d.error = true
                if (!d.error) data.errors.push({ e: '1', file: f.name, line: data.lines, k: k })
              }
              else {
                if (k === 'date') d[k] = f.date(r[head.indexOf(f.cols[k])])
                else d[k] = r[head.indexOf(f.cols[k])] * 1
              }
              if (!d[k] && d[k] !== 0 && !d.error) {
                d.error = true
                data.errors.push({ e: '2', file: f.name, line: data.lines, k: k })
              }
            }
            if (!d.error && ((!d.x && d.x !== 0) || (!d.y && d.y !== 0) || !d.date)) {
              d.error = true
              data.errors.push({ e: '3', file: f.name, line: data.lines, x: d.x, y: d.y })
            }
            if (!d.error && f.filter) Object.keys(f.filter).forEach(x => {
              let l = { line: data.lines }
              if (x === 'date') {
                if (!d.filter && (d.date.getFullYear() < f.filter.date.min || d.date.getFullYear() > f.filter.date.max)) {
                  d.filter = true
                  l[x] = d[x].toString()
                  data.filter++ //.push(l)
                }
              }
              else {
                if (!d.filter && (d[x] < f.filter[x].min || d[x] > f.filter[x].max)) {
                  d.filter = true
                  l[x] = d[x]
                  data.filter++ //.push(l)
                }
              }
            })
            if (!d.error && !d.filter) {
              const year = d.date.getFullYear()
              const month = d.date.getMonth()
              const p = Math.round(d.x * 10000) + d.y
              if (!data.ps[year]) data.ps[year] = {}
              if (!data.ps[year][month]) data.ps[year][month] = {}
              if (!data.ps[year][month][p]) {
                data.ps[year][month][p] = d
                  ;['x', 'y', 'CO2', 'SSS', 'SST', 'ABUN'].forEach(k => {
                    if (data.l[k] === undefined) data.l[k] = { min: d[k], max: d[k] }
                    else if (d[k] === -1e34) { /*skip*/ }
                    else if (d[k] < data.l[k].min) data.l[k].min = d[k]
                    else if (d[k] > data.l[k].max) data.l[k].max = d[k]
                  })

              }
              else data.errors.push({ e: 'dupe', file: f.name, line: data.lines, x: d.x, y: d.y })
            }
          }
          if (data.errors.length < f.errors) {
            /* Object.keys(data.ps).forEach(p => {
               const n = Object.keys(data.ps[p]).length
               Object.keys(data.ps[p]).forEach(y => {
                 if (!data.ys[y]) data.ys[y] = []
                 if (!data.ys[y][n]) data.ys[y][n] = []
                 data.ys[y][n].push(p)
               })
               if (!data.n[n]) data.n[n] = []
               data.n[n].push(p)
             })
             data.t = this.totals(data)
             */
            resolve(data)
          }
          else reject(data)
        })
    })
  }
  totals(data) {
    const ret = {}
    Object.keys(data.ys).forEach(y => {
      Object.keys(data.ys[y]).forEach(c => {
        let t = 0, n = 0
        data.ys[y][c].forEach(p => {
          data.ps[p][y].forEach(d => {
            n += 1 / data.ps[p][y].length
            t += d.n / data.ps[p][y].length
          })
        })
        if (!ret[y]) ret[y] = {}
        if (!ret[y][c]) ret[y][c] = {}
        ret[y][c] = { n: n, t: t }
      })
    })
    //console.log('totals',ret)
    return ret
  }
  render() {
    const y = this.state.y, y2 = this.state.y2
    const m = this.state.m, m2 = this.state.m2
    const f = this.state.f
    const socat = this.state.socat
    const cpr = this.state.cpr
    if (!socat) return <div>loading data ...</div>
    //console.log('cpr', { limits: cpr.l, Jul2018: cpr.ps[2018][6] })
    /*else if (!this.state.y && !this.timer) this.timer = setTimeout(() => {
      this.timer = null
      if (month < 11) this.setState({ month: month + 1 })
      else this.setState({ month: 0 })
    }, month === 10 ? 5000 : 1000)
    */
    return <div>
      <div>
        <Select ks={Object.keys(socat.ps)} k={y} set={y => this.setState({ y: y })} name="Year" />
        <Select ks={mnth} k={mnth[m]} set={m => this.setState({ m: m && mnth.indexOf(m) })} name="Month" />
        <Select ks={Object.keys(socat.ps)} k={y2} set={y => this.setState({ y2: y })} name="...Year" />
        <Select ks={mnth} k={mnth[m2]} set={m => this.setState({ m2: m && mnth.indexOf(m) })} name="...Month" />
        <Select ks={['CO2', 'SSS', 'SST', 'ABUN']} k={this.state.f} set={f => this.setState({ f: f })} name="Field" />
        <span> {y}{y2 ? '-' + y2 : null} {mnth[m]}{m2 ? '-' + mnth[m2] : null}</span>
      </div>
      {socat && <Map bounds={[[socat.l.x.min, socat.l.y.min], [socat.l.x.max, socat.l.y.max]]}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        />
        {f && <PYM data={f === 'ABUN' ? cpr : socat} m={m} y={y} y2={y2} m2={m2} f={f} />}
      </Map>}
    </div>
  }
  //      {data && <Totals data={data} />}
}

class PYM extends Component {
  render() {
    const y = this.props.y, m = this.props.m, y2 = this.props.y2, m2 = this.props.m2, f = this.props.f, d = this.props.data,
      ys = Object.keys(d.ps)
    console.log('PYM', { y, y2, m, m2, f, d, l: d.l })
    let ret = []
    ys.forEach(yr => {
      if (!y || yr === y || (y2 && yr <= y2 && yr > y)) {
        mnth.forEach(mn => {
          const mi = mnth.indexOf(mn)
          if ((!m && m !== 0) || mi === m || (m2 && mi > m && mi <= m2)) {
            const ps = points({ i: ret.length, y: yr, m: mi, f, d })
            ret = ret.concat(ps)
            console.log(yr, mn, ps.length)
          }
        })
      }
    })
    return ret.length ? ret.map(p => <CircleMarker key={p.key} center={p.center} radius={p.radius} color={p.color} />) : null
  }
}

function points(p) {
  let i = p.i || 0, ret = []
  const y = p.y, m = p.m, f = p.f, d = p.d,
    ps = y && (m || m === 0) && d.ps[y] && d.ps[y][m] && Object.keys(d.ps[y][m])
  //console.log('Points', { y, m, f, d, l: d.l })
  if (ps) ps.forEach(p => {
    const v = d.ps[y][m][p]
    const l = d.l, c = (v[f] - l[f].min) / (l[f].max - l[f].min)
    const color = v[f] && '#00' + (255 - Math.round(c * 255)).toString(16) + '00'
    //if (color.length !== 7) console.log(color) - 0 if v[f]===0 so just dot
    if (v[f] !== -1e34) ret.push({ key: i++, center: [v.x, v.y], radius: 1, color: color })
  })
  return ret
}

/*
class Totals extends Component {
  render() {
    const d = this.props.data, totals = this.props.data['t']
    return <table>
      <thead><tr><th>Years</th>
        {Object.keys(d.n).reverse().map(n => {
          return <th colSpan={4} key={n}>{n}</th>
        })}
      </tr>
        <tr><th>Year</th>
          {Object.keys(d.n).reverse().map(n => {
            return <React.Fragment key={n}><th>n</th><th>total</th><th>μ</th><th>μ+</th></React.Fragment>
          })}
        </tr>
      </thead>
      <tbody>
        {Object.keys(totals).map(y => {
          let t = 0, n = 0
          return <tr key={y}><td>{y}</td>
            {Object.keys(d.n).reverse().map(c => {
              if (!totals[y][c]) return <React.Fragment key={c}><td></td><td></td><td></td><td></td></React.Fragment>
              const dt = totals[y][c].t, dn = totals[y][c].n
              t += dt
              n += dn
              return <React.Fragment key={c}><td>{Math.round(dn)}</td><td>{Math.round(dt)}</td><td>{Math.round(dt / dn)}</td><td>{Math.round(t / n)}</td></React.Fragment>
            })}</tr>
        })}
      </tbody>
    </table>
  }
}
*/

class Select extends Component {
  set = (e) => {
    e.preventDefault()
    this.props.set(e.target.value)
  }
  render() {
    let options = [<option key={''} value=''>{this.props.name}</option>]
    this.props.ks.forEach(e => { options.push(<option key={e}>{e}</option>) })
    return <span>
      <select value={this.props.k || ''} onChange={this.set}>{options}</select>
    </span>
  }
}

export { Emma }