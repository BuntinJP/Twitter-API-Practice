fn main() {
    let mut s = String::new();
    std::io::stdin().read_line(&mut s).ok();
    let x: i32 = s.trim().parse().unwrap();
    println!("{}", x*x*x);
}