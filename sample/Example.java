public class Example {
    static int abs(int x){
        if (x < 0){
            return -x;
        }
        return x;
    }

    public static void main(String[] args) {
        System.out.println(abs(-5));
    }
}
