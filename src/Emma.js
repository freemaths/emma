import React, { Component } from 'react'
import csv from './data.csv'
class Emma extends Component {
  state={}
  componentDidMount() {
    //ajax('data.csv').then(r=>{
    fetch(csv)
  .then(function(response) {
    return response.text()
  })
  .then(csv=>{
      let rows=csv.split(/\r\n|\n/).map(l=>{return l.replace(/"([^,]*), ([^,]*)"/,"$2 $1").replace(/"/g,'').split(',')})
      const head=rows[0]
      //["Sample_Id", "Latitude", "Longitude", "Midpoint_Date_Local", "Year", "Month", "195", "10508", "10509", "10510", "10511", "10512", "10513", "10514", "10515"]
      rows.shift()
      let data={l:{},ps:{},ys:{},n:[]}
      rows.forEach(r=>{
        const year=r[head.indexOf('Year')]*1,x=r[head.indexOf('Latitude')]*1,y=r[head.indexOf("Longitude")]*1,n=r[head.indexOf("195")]*1,date=new Date(r[head.indexOf("Midpoint_Date_Local")])
        if (year>1992 && year<2019)
        {
          const d={x:x,y:y,date:date,n:n}
          if (!data[year]) data[year]=[]
          data[year].push(d)
          const p=Math.round(d.x)*1000+Math.round(d.y)
          if (!data.ps[p]) data.ps[p]={}
          data.ps[p][year]=year
          ;['x','y','n'].forEach(k=>{
            if (data.l[k]===undefined) data.l[k]={min:d[k],max:d[k]}
            else if (d[k]<data.l[k].min) data.l[k].min=d[k]
            else if (d[k]>data.l[k].max) data.l[k].max=d[k]
          })
        }
      })
      Object.keys(data.ps).forEach(p=>{
        const n=Object.keys(data.ps[p]).length
        Object.keys(data.ps[p]).forEach(y=>{
          if (!data.ys[y]) data.ys[y]=[]
          if (!data.ys[y][n]) data.ys[y][n]=1
          else data.ys[y][n]++
        })
        if (!data.n[n]) data.n[n]=n
      })
      this.setState({data:data,year:1993,n:0})
      //console.log('data',data)
    })
  }
  draw() {
    const year=this.state.y||this.state.year
    if (this.canvas) {
      if (!this.ctx) this.ctx=this.canvas.getContext("2d")
      this.ctx.clearRect(0, 0, 800, 600)
      this.state.data[year].forEach(d=>{
        const p=Math.round(d.x)*1000+Math.round(d.y)
        if (Object.keys(this.state.data.ps[p]).length>=this.state.n) {
          const l=this.state.data.l
          this.ctx.beginPath()
          if (d.n===0) this.ctx.strokeStyle = "rgb(255, 255, 200)"
          else this.ctx.strokeStyle ='rgb(0,'+Math.round((1-(d.n-l.n.min)/(l.n.max-l.n.min))*255)+', 0)'  
          this.ctx.arc(10+(d.x-l.x.min)/(l.x.max-l.x.min)*780,10+(d.y-l.y.min)/(l.y.max-l.y.min)*580, 1, 0, 2 * Math.PI, true)
          this.ctx.stroke()
        }
      })
    }
  }
  render() {
    const year=this.state.y||this.state.year
    if (!year) return null
    else this.draw()
    if (!this.state.y) setTimeout(()=>this.setState({year:year===2018?1993:year+1}),year===2018?2000:300)
    return <div>
      <div>
        <Select ks={Object.keys(this.state.data.ys)} k={this.state.y} set={(y)=>this.setState({y:y})} name="Year" />
        <Select ks={Object.keys(this.state.data.n).reverse()} k={this.state.n} set={(n)=>this.setState({n:n})} name="N" />
        <span>{year}</span>
      </div>
      <canvas ref={r=>this.canvas=r} width={800} height={600}/>
      </div> 
  }
}

class Select extends Component {
  set=(e)=>{
    e.preventDefault()
    this.props.set(e.target.value)
  }
  render() {
  let options=[<option key={0} value=''>{this.props.name}</option>]
    this.props.ks.forEach(e=>{options.push(<option key={e}>{e}</option>)})
    return <span>
      <select value={this.props.k||''} onChange={this.set}>{options}</select>
    </span>
  }
}

export default Emma
